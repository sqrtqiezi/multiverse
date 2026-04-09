import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createConfigSnapshot } from '../config-snapshot.js';

describe('createConfigSnapshot', () => {
  let tempHome: string;

  beforeEach(async () => {
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-snapshot-'));
  });

  afterEach(async () => {
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it('captures CLAUDE.md content when present', async () => {
    await fs.writeFile(path.join(tempHome, 'CLAUDE.md'), '# My Config');
    await fs.mkdir(path.join(tempHome, '.claude'), { recursive: true });

    const snapshot = await createConfigSnapshot(tempHome);

    expect(snapshot.claudeMd).toBe('# My Config');
  });

  it('sets claudeMd to undefined when CLAUDE.md is absent', async () => {
    await fs.mkdir(path.join(tempHome, '.claude'), { recursive: true });

    const snapshot = await createConfigSnapshot(tempHome);

    expect(snapshot.claudeMd).toBeUndefined();
  });

  it('captures files from .claude/ directory', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{"key": "value"}');

    const snapshot = await createConfigSnapshot(tempHome);

    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.files[0].path).toBe('settings.json');
    expect(snapshot.files[0].content).toBe('{\n  "key": "value"\n}');
  });

  it('captures nested files with relative paths', async () => {
    const skillsDir = path.join(tempHome, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(path.join(skillsDir, 'my-skill.md'), '# Skill');

    const snapshot = await createConfigSnapshot(tempHome);

    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.files[0].path).toBe('skills/my-skill.md');
    expect(snapshot.files[0].content).toBe('# Skill');
  });

  it('returns empty files array when .claude/ directory is empty', async () => {
    await fs.mkdir(path.join(tempHome, '.claude'), { recursive: true });

    const snapshot = await createConfigSnapshot(tempHome);

    expect(snapshot.files).toEqual([]);
  });

  it('throws when .claude/ directory does not exist', async () => {
    await expect(createConfigSnapshot(tempHome)).rejects.toThrow();
  });

  it('skips Claude Code internal runtime directories', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{}');

    const excludedDirs = [
      'projects',
      'teams',
      'tasks',
      'worktrees',
      'memory',
      'file-history',
      'usage-data',
      'telemetry',
      'paste-cache',
      'session-env',
      'todos',
      'backups',
      'shell-snapshots',
      'sessions',
      'plans',
    ];

    for (const dir of excludedDirs) {
      const internalDir = path.join(claudeDir, dir);
      await fs.mkdir(internalDir, { recursive: true });
      await fs.writeFile(path.join(internalDir, 'state.json'), '{"internal": true}');
    }

    const snapshot = await createConfigSnapshot(tempHome);

    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.files[0].path).toBe('settings.json');
  });

  it('includes plugins/cache and other plugins files', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    const pluginsDir = path.join(claudeDir, 'plugins');
    const cacheDir = path.join(pluginsDir, 'cache', 'some-plugin');
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(path.join(cacheDir, 'data.json'), '{}');
    await fs.writeFile(path.join(pluginsDir, 'installed_plugins.json'), '[]');

    const snapshot = await createConfigSnapshot(tempHome);

    const paths = snapshot.files.map((f) => f.path);
    expect(paths).toContain('plugins/installed_plugins.json');
    expect(paths).toContain('plugins/cache/some-plugin/data.json');
  });

  it('includes plugins/cache files in snapshot', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    const pluginDir = path.join(
      claudeDir,
      'plugins',
      'cache',
      'my-marketplace',
      'my-plugin',
      '1.0.0',
    );
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'plugin.json'), '{"name": "my-plugin"}');

    const snapshot = await createConfigSnapshot(tempHome);

    const paths = snapshot.files.map((f) => f.path);
    expect(paths).toContain(
      'plugins/cache/my-marketplace/my-plugin/1.0.0/plugin.json',
    );
  });

  it('excludes plugins/marketplaces directory', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    const marketplacesDir = path.join(
      claudeDir,
      'plugins',
      'marketplaces',
      'some-marketplace',
    );
    await fs.mkdir(marketplacesDir, { recursive: true });
    await fs.writeFile(
      path.join(marketplacesDir, 'marketplace.json'),
      '{"name": "test"}',
    );

    const snapshot = await createConfigSnapshot(tempHome);

    const paths = snapshot.files.map((f) => f.path);
    expect(paths).not.toContain(
      'plugins/marketplaces/some-marketplace/marketplace.json',
    );
  });

  it('excludes plugins/data directory', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    const dataDir = path.join(claudeDir, 'plugins', 'data', 'some-plugin');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, 'state.json'), '{"state": "active"}');

    const snapshot = await createConfigSnapshot(tempHome);

    const paths = snapshot.files.map((f) => f.path);
    expect(paths).not.toContain('plugins/data/some-plugin/state.json');
  });

  it('excludes .git directories at any depth', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    const pluginDir = path.join(
      claudeDir,
      'plugins',
      'cache',
      'my-marketplace',
      'my-plugin',
      '1.0.0',
    );
    const gitDir = path.join(pluginDir, '.git');
    await fs.mkdir(gitDir, { recursive: true });
    await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main');
    await fs.writeFile(path.join(pluginDir, 'plugin.json'), '{"name": "my-plugin"}');

    const snapshot = await createConfigSnapshot(tempHome);

    const paths = snapshot.files.map((f) => f.path);
    expect(paths).toContain(
      'plugins/cache/my-marketplace/my-plugin/1.0.0/plugin.json',
    );
    expect(paths).not.toContain(
      'plugins/cache/my-marketplace/my-plugin/1.0.0/.git/HEAD',
    );
  });

  it('excludes history.jsonl, vim swap files, and backup files', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{}');
    await fs.writeFile(path.join(claudeDir, 'history.jsonl'), '{}');
    await fs.writeFile(path.join(claudeDir, '.CLAUDE.md.swp'), 'swap');
    await fs.writeFile(path.join(claudeDir, 'settings.json.bak'), 'backup');

    const snapshot = await createConfigSnapshot(tempHome);

    const paths = snapshot.files.map((f) => f.path);
    expect(paths).toEqual(['settings.json']);
  });

  it('removes hooks from settings.json during snapshot', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    const settings = {
      hooks: {
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: '/usr/local/bin/hook.sh' }] }],
      },
      enabledPlugins: { 'superpowers@marketplace': true },
      model: 'opus',
    };
    await fs.writeFile(path.join(claudeDir, 'settings.json'), JSON.stringify(settings));

    const snapshot = await createConfigSnapshot(tempHome);

    const settingsFile = snapshot.files.find((f) => f.path === 'settings.json');
    expect(settingsFile).toBeDefined();
    const parsed = JSON.parse(settingsFile!.content);
    expect(parsed.hooks).toBeUndefined();
    expect(parsed.enabledPlugins).toEqual({ 'superpowers@marketplace': true });
    expect(parsed.model).toBe('opus');
  });

  it('leaves settings.json unchanged if not valid JSON', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(claudeDir, 'settings.json'), 'not json');

    const snapshot = await createConfigSnapshot(tempHome);

    const settingsFile = snapshot.files.find((f) => f.path === 'settings.json');
    expect(settingsFile).toBeDefined();
    expect(settingsFile!.content).toBe('not json');
  });

  it('skips directories with permission errors instead of throwing', async () => {
    const claudeDir = path.join(tempHome, '.claude');
    const restrictedDir = path.join(claudeDir, 'restricted');
    await fs.mkdir(restrictedDir, { recursive: true });
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{}');
    await fs.chmod(restrictedDir, 0o000);

    const snapshot = await createConfigSnapshot(tempHome);

    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.files[0].path).toBe('settings.json');

    // Restore permissions for cleanup
    await fs.chmod(restrictedDir, 0o755);
  });
});
