import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ConfigSnapshot } from '@multiverse/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLAUDE_HOME_CONTAINER_PATH } from '../../verse/claude-home.js';
import { injectTemplateSnapshot } from '../template-injector.js';

describe('injectTemplateSnapshot', () => {
  let tempDir: string;
  let verseHomePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-inject-'));
    verseHomePath = path.join(tempDir, 'home');
    await fs.mkdir(path.join(verseHomePath, '.claude'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes claudeMd to verseHome/CLAUDE.md', async () => {
    const snapshot: ConfigSnapshot = {
      claudeMd: '# My Config',
      files: [],
    };

    await injectTemplateSnapshot(verseHomePath, snapshot);

    const content = await fs.readFile(path.join(verseHomePath, 'CLAUDE.md'), 'utf8');
    expect(content).toBe('# My Config');
  });

  it('skips claudeMd when undefined', async () => {
    const snapshot: ConfigSnapshot = {
      claudeMd: undefined,
      files: [{ path: 'settings.json', content: '{}' }],
    };

    await injectTemplateSnapshot(verseHomePath, snapshot);

    await expect(fs.access(path.join(verseHomePath, 'CLAUDE.md'))).rejects.toThrow();
  });

  it('writes files into verseHome/.claude/', async () => {
    const snapshot: ConfigSnapshot = {
      files: [{ path: 'settings.json', content: '{"key":"val"}' }],
    };

    await injectTemplateSnapshot(verseHomePath, snapshot);

    const content = await fs.readFile(
      path.join(verseHomePath, '.claude', 'settings.json'),
      'utf8',
    );
    expect(content).toBe('{"key":"val"}');
  });

  it('creates nested directories for files', async () => {
    const snapshot: ConfigSnapshot = {
      files: [{ path: 'skills/my-skill.md', content: '# Skill' }],
    };

    await injectTemplateSnapshot(verseHomePath, snapshot);

    const content = await fs.readFile(
      path.join(verseHomePath, '.claude', 'skills', 'my-skill.md'),
      'utf8',
    );
    expect(content).toBe('# Skill');
  });

  it('skips files with path traversal', async () => {
    const snapshot: ConfigSnapshot = {
      files: [
        { path: '../etc/passwd', content: 'bad' },
        { path: 'settings.json', content: '{}' },
      ],
    };

    await injectTemplateSnapshot(verseHomePath, snapshot);

    const files = await fs.readdir(path.join(verseHomePath, '.claude'));
    expect(files).toEqual(['settings.json']);
  });

  it('skips files with absolute paths', async () => {
    const snapshot: ConfigSnapshot = {
      files: [
        { path: '/etc/passwd', content: 'bad' },
        { path: 'settings.json', content: '{}' },
      ],
    };

    await injectTemplateSnapshot(verseHomePath, snapshot);

    const files = await fs.readdir(path.join(verseHomePath, '.claude'));
    expect(files).toEqual(['settings.json']);
  });

  it('rewrites installPath in installed_plugins.json to container path', async () => {
    const snapshot: ConfigSnapshot = {
      files: [
        {
          path: 'plugins/installed_plugins.json',
          content: JSON.stringify({
            version: 2,
            plugins: {
              'superpowers@marketplace': [
                {
                  scope: 'user',
                  installPath: '/home/alice/.claude/plugins/cache/marketplace/superpowers/4.3.1',
                  version: '4.3.1',
                },
              ],
            },
          }),
        },
      ],
    };

    await injectTemplateSnapshot(verseHomePath, snapshot);

    const content = await fs.readFile(
      path.join(verseHomePath, '.claude', 'plugins', 'installed_plugins.json'),
      'utf8',
    );
    const parsed = JSON.parse(content);
    expect(parsed.plugins['superpowers@marketplace'][0].installPath).toBe(
      `${CLAUDE_HOME_CONTAINER_PATH}/.claude/plugins/cache/marketplace/superpowers/4.3.1`,
    );
  });

  it('rewrites installLocation in known_marketplaces.json to container path', async () => {
    const snapshot: ConfigSnapshot = {
      files: [
        {
          path: 'plugins/known_marketplaces.json',
          content: JSON.stringify({
            'my-marketplace': {
              source: { source: 'github', repo: 'user/repo' },
              installLocation: '/home/alice/.claude/plugins/marketplaces/my-marketplace',
              lastUpdated: '2026-04-01T00:00:00.000Z',
            },
          }),
        },
      ],
    };

    await injectTemplateSnapshot(verseHomePath, snapshot);

    const content = await fs.readFile(
      path.join(verseHomePath, '.claude', 'plugins', 'known_marketplaces.json'),
      'utf8',
    );
    const parsed = JSON.parse(content);
    expect(parsed['my-marketplace'].installLocation).toBe(
      `${CLAUDE_HOME_CONTAINER_PATH}/.claude/plugins/marketplaces/my-marketplace`,
    );
  });

  it('writes installed_plugins.json as-is when content is not valid JSON', async () => {
    const snapshot: ConfigSnapshot = {
      files: [
        {
          path: 'plugins/installed_plugins.json',
          content: 'not json',
        },
      ],
    };

    await injectTemplateSnapshot(verseHomePath, snapshot);

    const content = await fs.readFile(
      path.join(verseHomePath, '.claude', 'plugins', 'installed_plugins.json'),
      'utf8',
    );
    expect(content).toBe('not json');
  });
});
