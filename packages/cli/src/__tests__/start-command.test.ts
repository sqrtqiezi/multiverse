import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CredentialConfig, Verse } from '@multiverse/types';
import { afterEach, describe, expect, it } from 'vitest';
import { buildContainerConfig, syncCredentialFilesIntoVerseHome } from '../commands/start.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map(async (dirPath) => {
      await fs.rm(dirPath, { recursive: true, force: true });
    }),
  );
  tempDirs.length = 0;
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

    const config = buildContainerConfig({
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
      const config = buildContainerConfig({
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

    await syncCredentialFilesIntoVerseHome(verseHomePath, {
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
