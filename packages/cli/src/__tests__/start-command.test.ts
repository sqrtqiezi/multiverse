import { describe, expect, it } from 'vitest';
import type { CredentialConfig, Verse } from '@multiverse/types';
import { buildContainerConfig } from '../commands/start.js';

describe('buildContainerConfig', () => {
  it('includes the verse environment mount when starting a container', () => {
    const verse: Verse = {
      schemaVersion: 2,
      id: 'verse-1',
      branch: 'main',
      projectRoot: '/repo',
      environment: {
        hostPath: '/repo/.multiverse/verse-envs/verse-1/claude-home',
        containerPath: '/home/node/.claude',
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
          containerPath: '/home/node/.claude/credentials.json',
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
      hostPath: '/repo/.multiverse/verse-envs/verse-1/claude-home',
      containerPath: '/home/node/.claude',
      mode: 'rw',
    });
    expect(config.env).toMatchObject({
      ANTHROPIC_API_KEY: 'test-key',
      HOME: '/home/node',
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
        hostPath: '/repo/.multiverse/verse-envs/verse-1/claude-home',
        containerPath: '/home/node/.claude',
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
        HOME: '/home/node',
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
});
