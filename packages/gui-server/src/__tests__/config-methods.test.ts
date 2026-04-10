import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
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

  it('returns project CLAUDE.md when it exists', async () => {
    await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), '# Project');
    const result = (await configMethods['config.listFiles']!({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    const projectGroup = result.groups.find((g) => g.label === '项目配置');
    expect(projectGroup).toBeDefined();
    const claudeMd = projectGroup!.files.find((f) => f.path === 'CLAUDE.md');
    expect(claudeMd).toBeDefined();
  });

  it('returns global CLAUDE.md when it exists', async () => {
    await fs.writeFile(path.join(homeDir, 'CLAUDE.md'), '# Global');
    const result = (await configMethods['config.listFiles']!({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    const globalGroup = result.groups.find((g) => g.label === '全局配置');
    expect(globalGroup).toBeDefined();
    const claudeMd = globalGroup!.files.find((f) => f.path === 'CLAUDE.md');
    expect(claudeMd).toBeDefined();
  });

  it('returns files in .claude directory', async () => {
    const claudeDir = path.join(projectDir, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{}');

    const result = (await configMethods['config.listFiles']!({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    const projectGroup = result.groups.find((g) => g.label === '项目配置');
    const settings = projectGroup!.files.find((f) => f.path === '.claude/settings.json');
    expect(settings).toBeDefined();
  });

  it('returns empty groups when nothing exists', async () => {
    const result = (await configMethods['config.listFiles']!({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    expect(result.groups).toBeDefined();
    expect(result.groups.length).toBeGreaterThanOrEqual(2);
  });
});
