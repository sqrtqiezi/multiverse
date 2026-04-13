import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { computeSnapshotFingerprint, getVersePath } from '@multiverse/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configMethods } from '../methods/config.js';

describe('config.listFiles', () => {
  let tmpDir: string;
  let projectDir: string;
  let homeDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gui-server-test-'));
    projectDir = path.join(tmpDir, 'project');
    homeDir = path.join(tmpDir, 'home');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(homeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('does not return project CLAUDE.md when no template exists', async () => {
    await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), '# Project');
    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    expect(result.groups).toEqual([]);
  });

  it('does not return global CLAUDE.md when no template exists', async () => {
    await fs.writeFile(path.join(homeDir, 'CLAUDE.md'), '# Global');
    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    expect(result.groups).toEqual([]);
  });

  it('does not return project .claude files when no template exists', async () => {
    const claudeDir = path.join(projectDir, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{}');

    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    expect(result.groups).toEqual([]);
  });

  it('returns empty groups when no template exists', async () => {
    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    expect(result.groups).toEqual([]);
  });

  it('uses the sidecar working directory and home directory when paths are omitted', async () => {
    const originalCwd = process.cwd();
    const originalHome = process.env.HOME;
    const originalProjectPath = process.env.MULTIVERSE_GUI_PROJECT_PATH;
    const originalGuiHomePath = process.env.MULTIVERSE_GUI_HOME_PATH;
    const templatesDir = path.join(homeDir, '.multiverse', 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, 'tpl-1.json'),
      JSON.stringify({
        id: 'tpl-1',
        name: 'default',
        snapshot: { claudeMd: '# Template Config', files: [] },
        fingerprint: computeSnapshotFingerprint({ claudeMd: '# Template Config', files: [] }),
        createdAt: '2026-04-10T00:00:00.000Z',
      }),
    );

    try {
      process.chdir(projectDir);
      process.env.HOME = homeDir;
      delete process.env.MULTIVERSE_GUI_PROJECT_PATH;
      delete process.env.MULTIVERSE_GUI_HOME_PATH;

      const result = (await configMethods['config.listFiles']?.({})) as {
        groups: Array<{ label: string; basePath: string; files: Array<{ path: string }> }>;
      };

      expect(result.groups[0]?.basePath).toBe('tpl-1');
      expect(result.groups[0]?.files.find((f) => f.path === 'CLAUDE.md')).toBeDefined();
    } finally {
      process.chdir(originalCwd);
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
      if (originalProjectPath === undefined) {
        delete process.env.MULTIVERSE_GUI_PROJECT_PATH;
      } else {
        process.env.MULTIVERSE_GUI_PROJECT_PATH = originalProjectPath;
      }
      if (originalGuiHomePath === undefined) {
        delete process.env.MULTIVERSE_GUI_HOME_PATH;
      } else {
        process.env.MULTIVERSE_GUI_HOME_PATH = originalGuiHomePath;
      }
    }
  });

  it('uses GUI path overrides when paths are omitted', async () => {
    const originalProjectPath = process.env.MULTIVERSE_GUI_PROJECT_PATH;
    const originalGuiHomePath = process.env.MULTIVERSE_GUI_HOME_PATH;
    const templatesDir = path.join(homeDir, '.multiverse', 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, 'tpl-1.json'),
      JSON.stringify({
        id: 'tpl-1',
        name: 'default',
        snapshot: { claudeMd: '# Template Config', files: [] },
        fingerprint: computeSnapshotFingerprint({ claudeMd: '# Template Config', files: [] }),
        createdAt: '2026-04-10T00:00:00.000Z',
      }),
    );

    try {
      process.env.MULTIVERSE_GUI_PROJECT_PATH = projectDir;
      process.env.MULTIVERSE_GUI_HOME_PATH = homeDir;

      const result = (await configMethods['config.listFiles']?.({})) as {
        groups: Array<{ label: string; basePath: string; files: Array<{ path: string }> }>;
      };

      expect(result.groups[0]?.basePath).toBe('tpl-1');
      expect(result.groups[0]?.files.find((f) => f.path === 'CLAUDE.md')).toBeDefined();
    } finally {
      if (originalProjectPath === undefined) {
        delete process.env.MULTIVERSE_GUI_PROJECT_PATH;
      } else {
        process.env.MULTIVERSE_GUI_PROJECT_PATH = originalProjectPath;
      }
      if (originalGuiHomePath === undefined) {
        delete process.env.MULTIVERSE_GUI_HOME_PATH;
      } else {
        process.env.MULTIVERSE_GUI_HOME_PATH = originalGuiHomePath;
      }
    }
  });

  it('returns the current branch template snapshot instead of project files', async () => {
    const templatesDir = path.join(homeDir, '.multiverse', 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, 'tpl-1.json'),
      JSON.stringify({
        id: 'tpl-1',
        name: 'default',
        snapshot: {
          claudeMd: '# Template Config',
          files: [{ path: 'settings.json', content: '{}' }],
        },
        fingerprint: 'old',
        createdAt: '2026-04-10T00:00:00.000Z',
      }),
    );
    await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), '# Project Config');

    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; basePath: string; files: Array<{ path: string }> }> };

    expect(result.groups).toEqual([
      {
        label: '模板: default',
        basePath: 'tpl-1',
        files: [
          { path: 'CLAUDE.md', type: 'markdown' },
          { path: '.claude/settings.json', type: 'json' },
        ],
      },
    ]);
  });

  it('prefers the current branch verse template over the default template', async () => {
    execFileSync('git', ['init', '-b', 'main'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectDir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: projectDir });
    await fs.writeFile(path.join(projectDir, 'README.md'), '# test\n');
    execFileSync('git', ['add', 'README.md'], { cwd: projectDir });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: projectDir, stdio: 'ignore' });

    const templatesDir = path.join(homeDir, '.multiverse', 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, 'default-template.json'),
      JSON.stringify({
        id: 'default-template',
        name: 'default',
        snapshot: { claudeMd: '# Default Template', files: [] },
        fingerprint: computeSnapshotFingerprint({ claudeMd: '# Default Template', files: [] }),
        createdAt: '2026-04-10T00:00:00.000Z',
      }),
    );
    await fs.writeFile(
      path.join(templatesDir, 'branch-template.json'),
      JSON.stringify({
        id: 'branch-template',
        name: 'branch-template',
        snapshot: { claudeMd: '# Branch Template', files: [] },
        fingerprint: computeSnapshotFingerprint({ claudeMd: '# Branch Template', files: [] }),
        createdAt: '2026-04-10T00:00:01.000Z',
      }),
    );
    await fs.mkdir(path.dirname(getVersePath(projectDir, 'main')), { recursive: true });
    await fs.writeFile(
      getVersePath(projectDir, 'main'),
      JSON.stringify({
        schemaVersion: 3,
        id: 'verse-1',
        branch: 'main',
        projectRoot: projectDir,
        templateId: 'branch-template',
        environment: {
          hostPath: path.join(projectDir, '.multiverse', 'verse-envs', 'verse-1', 'home'),
          containerPath: '/home/node',
          initializedAt: '2026-04-10T00:00:00.000Z',
        },
        createdAt: '2026-04-10T00:00:00.000Z',
        updatedAt: '2026-04-10T00:00:00.000Z',
        runs: [],
      }),
    );

    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; basePath: string; files: Array<{ path: string }> }> };

    expect(result.groups[0]?.label).toBe('模板: branch-template');
    expect(result.groups[0]?.basePath).toBe('branch-template');
  });
});

describe('config.readFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gui-server-read-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads file content', async () => {
    const filePath = path.join(tmpDir, 'test.md');
    await fs.writeFile(filePath, '# Hello World');
    const result = (await configMethods['config.readFile']?.({ filePath })) as { content: string };
    expect(result.content).toBe('# Hello World');
  });

  it('throws for nonexistent file', async () => {
    await expect(
      configMethods['config.readFile']?.({ filePath: path.join(tmpDir, 'missing.md') }),
    ).rejects.toThrow();
  });

  it('reads content from a template snapshot', async () => {
    const templatesDir = path.join(tmpDir, 'home', '.multiverse', 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, 'tpl-1.json'),
      JSON.stringify({
        id: 'tpl-1',
        name: 'default',
        snapshot: {
          claudeMd: '# Template Config',
          files: [{ path: 'settings.json', content: '{}' }],
        },
        fingerprint: 'old',
        createdAt: '2026-04-10T00:00:00.000Z',
      }),
    );

    const result = (await configMethods['config.readFile']?.({
      homePath: path.join(tmpDir, 'home'),
      templateId: 'tpl-1',
      filePath: 'CLAUDE.md',
    })) as { content: string };

    expect(result.content).toBe('# Template Config');
  });
});

describe('config.writeFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gui-server-write-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes content to file', async () => {
    const filePath = path.join(tmpDir, 'test.md');
    await fs.writeFile(filePath, 'old');
    const result = (await configMethods['config.writeFile']?.({
      filePath,
      content: '# New Content',
    })) as { success: boolean };

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toBe('# New Content');
  });

  it('creates file if it does not exist', async () => {
    const filePath = path.join(tmpDir, 'new.md');
    const result = (await configMethods['config.writeFile']?.({
      filePath,
      content: '# Created',
    })) as { success: boolean };

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toBe('# Created');
  });

  it('writes content to a template snapshot and updates the fingerprint', async () => {
    const homeDir = path.join(tmpDir, 'home');
    const templatesDir = path.join(homeDir, '.multiverse', 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    const templatePath = path.join(templatesDir, 'tpl-1.json');
    await fs.writeFile(
      templatePath,
      JSON.stringify({
        id: 'tpl-1',
        name: 'default',
        snapshot: {
          claudeMd: '# Template Config',
          files: [{ path: 'settings.json', content: '{}' }],
        },
        fingerprint: 'old',
        createdAt: '2026-04-10T00:00:00.000Z',
      }),
    );

    const result = (await configMethods['config.writeFile']?.({
      homePath: homeDir,
      templateId: 'tpl-1',
      filePath: '.claude/settings.json',
      content: '{"model":"opus"}',
    })) as { success: boolean };

    expect(result.success).toBe(true);
    const saved = JSON.parse(await fs.readFile(templatePath, 'utf8')) as {
      fingerprint: string;
      snapshot: { files: Array<{ path: string; content: string }> };
    };
    expect(saved.snapshot.files.find((file) => file.path === 'settings.json')?.content).toBe(
      '{"model":"opus"}',
    );
    expect(saved.fingerprint).not.toBe('old');
  });
});
