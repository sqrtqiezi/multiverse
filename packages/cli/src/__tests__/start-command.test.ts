import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { CredentialConfig, Template, Verse } from '@multiverse/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@multiverse/core';
import * as startModule from '../commands/start.js';

const tempDirs: string[] = [];
const originalCwd = process.cwd();
const originalHome = process.env.HOME;
const execFileAsync = promisify(execFile);

const baseTemplate: Template = {
  id: 'tpl-default',
  name: 'default',
  snapshot: {
    claudeMd: '# Base template',
    files: [{ path: 'settings.json', content: '{\n  "editor": "vim"\n}' }],
  },
  fingerprint: 'fingerprint-default',
  createdAt: '2026-04-09T00:00:00.000Z',
};

const syncedTemplate: Template = {
  id: 'tpl-synced',
  name: 'default-sync-2026-04-09T00:00:00.000Z',
  snapshot: {
    claudeMd: '# Synced template',
    files: [{ path: 'settings.json', content: '{\n  "editor": "helix"\n}' }],
  },
  fingerprint: 'fingerprint-synced',
  createdAt: '2026-04-09T00:00:01.000Z',
};

const currentVerse: Verse = {
  schemaVersion: 3,
  id: 'verse-1',
  branch: 'main',
  projectRoot: '/project',
  templateId: baseTemplate.id,
  environment: {
    hostPath: '/project/.multiverse/verse-envs/verse-1/home',
    containerPath: '/home/coder',
    initializedAt: '2026-04-09T00:00:00.000Z',
  },
  createdAt: '2026-04-09T00:00:00.000Z',
  updatedAt: '2026-04-09T00:00:00.000Z',
  runs: [],
};

const updatedVerse: Verse = {
  ...currentVerse,
  templateId: syncedTemplate.id,
  updatedAt: '2026-04-09T00:00:02.000Z',
};

const driftResult = {
  templateId: baseTemplate.id,
  templateName: baseTemplate.name,
  templateFingerprint: baseTemplate.fingerprint,
  currentFingerprint: 'fingerprint-current',
  isDrifted: true,
  addedFiles: [],
  modifiedFiles: ['CLAUDE.md'],
  removedFiles: [],
} as const;

afterEach(async () => {
  vi.restoreAllMocks();
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  delete process.env.MULTIVERSE_CLAUDE_PRINT_PROMPT;
  await Promise.all(
    tempDirs.map(async (dirPath) => {
      await fs.rm(dirPath, { recursive: true, force: true });
    }),
  );
  tempDirs.length = 0;
});

beforeEach(() => {
  vi.spyOn(core.PreflightChecker.prototype, 'runAll').mockResolvedValue(undefined);
  vi.spyOn(core.DockerClient.prototype, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '27.0.0',
  });
  vi.spyOn(core.ImageBuilder.prototype, 'ensureImage').mockResolvedValue(undefined);
  vi.spyOn(core.CredentialResolver.prototype, 'resolveCredentials').mockResolvedValue({
    filePaths: [],
    envVars: {
      ANTHROPIC_API_KEY: 'test-key',
    },
  });
  vi.spyOn(core.TemplateService.prototype, 'findByName').mockResolvedValue(baseTemplate);
  (core.TemplateService.prototype as any).createSyncedTemplate = vi
    .fn()
    .mockResolvedValue(syncedTemplate);
  vi.spyOn(core.VerseService.prototype, 'ensureVerseForCurrentBranch').mockResolvedValue(
    currentVerse,
  );
  (core.VerseService.prototype as any).updateTemplateForCurrentBranch = vi
    .fn()
    .mockResolvedValue(updatedVerse);
  vi.spyOn(core.VerseService.prototype, 'appendRunStart').mockResolvedValue(currentVerse);
  vi.spyOn(core.VerseService.prototype, 'finalizeRun').mockResolvedValue(currentVerse);
  vi.spyOn(core.ContainerManager.prototype, 'createAndStart').mockResolvedValue({
    id: 'container-1',
  } as any);
  vi.spyOn(core.ContainerManager.prototype, 'waitForExit').mockResolvedValue(0);
  vi.spyOn(core.ContainerManager.prototype, 'logs').mockResolvedValue('');
  vi.spyOn(core.ContainerManager.prototype, 'remove').mockResolvedValue(undefined);
  vi.spyOn(core, 'checkTemplateDrift').mockResolvedValue(driftResult);
  vi.spyOn(core, 'injectTemplateSnapshot').mockResolvedValue(undefined);
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => code as never) as never);
});

describe('buildContainerConfig', () => {
  it('mounts the persistent verse home at the container home directory', () => {
    const verse: Verse = {
      schemaVersion: 2,
      id: 'verse-1',
      branch: 'main',
      projectRoot: '/repo',
      environment: {
        hostPath: '/repo/.multiverse/verse-envs/verse-1/home',
        containerPath: '/home/coder',
        initializedAt: '2026-04-03T00:00:00.000Z',
      },
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
      runs: [],
    };
    const credentials: CredentialConfig = {
      filePaths: [
        {
          hostPath: '/host/.claude/credentials.json',
          containerPath: '/home/coder/.claude/credentials.json',
          mode: 'ro',
        },
      ],
      envVars: {
        ANTHROPIC_API_KEY: 'test-key',
      },
    };

    const config = startModule.buildContainerConfig({
      cwd: '/repo',
      imageTag: 'multiverse/claude-code:latest',
      verse,
      credentials,
      scriptedPrompt: 'test prompt',
    });

    expect(config.volumes).toContainEqual({
      hostPath: '/repo/.multiverse/verse-envs/verse-1/home',
      containerPath: '/home/coder',
      mode: 'rw',
    });
    expect(config.volumes).not.toContainEqual({
      hostPath: '/host/.claude/credentials.json',
      containerPath: '/home/coder/.claude/credentials.json',
      mode: 'ro',
    });
    expect(config.env).toMatchObject({
      ANTHROPIC_API_KEY: 'test-key',
      HOME: '/home/coder',
    });
    expect(config.user).toBe(`${process.getuid()}:${process.getgid()}`);
    expect(config.entrypoint).toEqual(['bash', '-lc', 'test prompt']);
    expect(config.tty).toBe(false);
    expect(config.autoRemove).toBe(false);
  });

  it('preserves interactive terminal settings for interactive mode', () => {
    const verse: Verse = {
      schemaVersion: 2,
      id: 'verse-1',
      branch: 'main',
      projectRoot: '/repo',
      environment: {
        hostPath: '/repo/.multiverse/verse-envs/verse-1/home',
        containerPath: '/home/coder',
        initializedAt: '2026-04-03T00:00:00.000Z',
      },
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
      runs: [],
    };
    const credentials: CredentialConfig = {
      filePaths: [],
      envVars: {
        ANTHROPIC_API_KEY: 'test-key',
      },
    };

    const originalTerm = process.env.TERM;
    process.env.TERM = 'xterm-256color';

    try {
      const config = startModule.buildContainerConfig({
        cwd: '/repo',
        imageTag: 'multiverse/claude-code:latest',
        verse,
        credentials,
      });

      expect(config.env).toMatchObject({
        ANTHROPIC_API_KEY: 'test-key',
        HOME: '/home/coder',
        TERM: 'xterm-256color',
      });
      expect(config.tty).toBe(true);
      expect(config.autoRemove).toBe(true);
      expect(config.entrypoint).toBeUndefined();
    } finally {
      if (originalTerm === undefined) {
        delete process.env.TERM;
      } else {
        process.env.TERM = originalTerm;
      }
    }
  });

  it('copies discovered credential files into the persistent verse home', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multiverse-start-command-'));
    tempDirs.push(tempDir);

    const verseHomePath = path.join(tempDir, 'verse-home');
    const sourceClaudeDir = path.join(tempDir, 'source-claude');
    await fs.mkdir(path.join(verseHomePath, '.claude'), { recursive: true });
    await fs.mkdir(sourceClaudeDir, { recursive: true });

    const credentialsPath = path.join(sourceClaudeDir, 'credentials.json');
    const dotCredentialsPath = path.join(sourceClaudeDir, '.credentials');
    await fs.writeFile(credentialsPath, '{"token":"abc"}\n', 'utf8');
    await fs.writeFile(dotCredentialsPath, 'session=xyz\n', 'utf8');

    await startModule.syncCredentialFilesIntoVerseHome(verseHomePath, {
      filePaths: [
        {
          hostPath: credentialsPath,
          containerPath: '/home/coder/.claude/credentials.json',
          mode: 'ro',
        },
        {
          hostPath: dotCredentialsPath,
          containerPath: '/home/coder/.claude/.credentials',
          mode: 'ro',
        },
      ],
      envVars: {},
    });

    await expect(
      fs.readFile(path.join(verseHomePath, '.claude', 'credentials.json'), 'utf8'),
    ).resolves.toBe('{"token":"abc"}\n');
    await expect(
      fs.readFile(path.join(verseHomePath, '.claude', '.credentials'), 'utf8'),
    ).resolves.toBe('session=xyz\n');
  });
});

describe('startCommand drift handling', () => {
  async function prepareCommandRoot() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-start-drift-'));
    tempDirs.push(tempDir);
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: tempDir });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
    await fs.writeFile(path.join(tempDir, 'README.md'), '# repo\n');
    await execFileAsync('git', ['add', '.'], { cwd: tempDir });
    await execFileAsync('git', ['commit', '-m', 'init'], { cwd: tempDir });
    process.chdir(tempDir);
    process.env.HOME = tempDir;
    process.env.MULTIVERSE_CLAUDE_PRINT_PROMPT = "printf '%s\\n' 'E2E_TEMPLATE_DRIFT_OK'";
    return tempDir;
  }

  it('keeps the current template when drift is accepted', async () => {
    await prepareCommandRoot();
    const promptForDriftAction = vi.fn().mockResolvedValue('keep' as const);

    await startModule.startCommand({ template: 'default', promptForDriftAction });

    expect(promptForDriftAction).toHaveBeenCalledWith(
      expect.objectContaining({ templateName: 'default' }),
    );
    expect(core.TemplateService.prototype.createSyncedTemplate).not.toHaveBeenCalled();
    expect(core.VerseService.prototype.updateTemplateForCurrentBranch).not.toHaveBeenCalled();
    expect(core.injectTemplateSnapshot).toHaveBeenCalledWith(
      currentVerse.environment.hostPath,
      baseTemplate.snapshot,
    );
    expect(core.VerseService.prototype.appendRunStart).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: baseTemplate.id }),
    );
  });

  it('syncs and switches to the new template when drift is accepted', async () => {
    const commandRoot = await prepareCommandRoot();
    const promptForDriftAction = vi.fn().mockResolvedValue('sync-and-switch' as const);

    await startModule.startCommand({ template: 'default', promptForDriftAction });

    expect(promptForDriftAction).toHaveBeenCalled();
    expect(core.TemplateService.prototype.createSyncedTemplate).toHaveBeenCalledWith({
      baseTemplateName: 'default',
      homeDir: commandRoot,
    });
    expect(core.VerseService.prototype.updateTemplateForCurrentBranch).toHaveBeenCalledWith(
      commandRoot,
      syncedTemplate.id,
    );
    expect(core.injectTemplateSnapshot).toHaveBeenCalledWith(
      updatedVerse.environment.hostPath,
      syncedTemplate.snapshot,
    );
    expect(core.VerseService.prototype.appendRunStart).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: syncedTemplate.id }),
    );
  });

  it('stops when drift is cancelled', async () => {
    await prepareCommandRoot();
    const promptForDriftAction = vi.fn().mockResolvedValue('cancel' as const);

    await expect(
      startModule.startCommand({ template: 'default', promptForDriftAction }),
    ).rejects.toMatchObject({
      code: 'START_CANCELLED',
      message: 'Start cancelled',
    });

    expect(core.TemplateService.prototype.createSyncedTemplate).not.toHaveBeenCalled();
    expect(core.VerseService.prototype.updateTemplateForCurrentBranch).not.toHaveBeenCalled();
    expect(core.injectTemplateSnapshot).not.toHaveBeenCalled();
  });

  it('checks drift against the verse-bound template when it differs from the named template', async () => {
    await prepareCommandRoot();

    // Verse is already bound to the synced template (from a previous sync-and-switch)
    vi.spyOn(core.VerseService.prototype, 'ensureVerseForCurrentBranch').mockResolvedValue(
      updatedVerse,
    );
    vi.spyOn(core.TemplateService.prototype, 'findById').mockResolvedValue(syncedTemplate);

    // Drift check against synced template returns no drift
    vi.spyOn(core, 'checkTemplateDrift').mockResolvedValue({
      ...driftResult,
      isDrifted: false,
      templateId: syncedTemplate.id,
      templateName: syncedTemplate.name,
    });

    const promptForDriftAction = vi.fn();
    await startModule.startCommand({ template: 'default', promptForDriftAction });

    // Should have looked up the verse's template
    expect(core.TemplateService.prototype.findById).toHaveBeenCalledWith(syncedTemplate.id);
    // Should have checked drift against the synced template, not the default
    expect(core.checkTemplateDrift).toHaveBeenCalledWith(
      expect.objectContaining({ template: syncedTemplate }),
    );
    // No drift prompt since synced template matches
    expect(promptForDriftAction).not.toHaveBeenCalled();
  });
});
