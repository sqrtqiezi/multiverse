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
    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    const projectGroup = result.groups.find((g) => g.label === '项目配置');
    expect(projectGroup).toBeDefined();
    const claudeMd = projectGroup?.files.find((f) => f.path === 'CLAUDE.md');
    expect(claudeMd).toBeDefined();
  });

  it('returns global CLAUDE.md when it exists', async () => {
    await fs.writeFile(path.join(homeDir, 'CLAUDE.md'), '# Global');
    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    const globalGroup = result.groups.find((g) => g.label === '全局配置');
    expect(globalGroup).toBeDefined();
    const claudeMd = globalGroup?.files.find((f) => f.path === 'CLAUDE.md');
    expect(claudeMd).toBeDefined();
  });

  it('returns files in .claude directory', async () => {
    const claudeDir = path.join(projectDir, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{}');

    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    const projectGroup = result.groups.find((g) => g.label === '项目配置');
    const settings = projectGroup?.files.find((f) => f.path === '.claude/settings.json');
    expect(settings).toBeDefined();
  });

  it('returns empty groups when nothing exists', async () => {
    const result = (await configMethods['config.listFiles']?.({
      projectPath: projectDir,
      homePath: homeDir,
    })) as { groups: Array<{ label: string; files: Array<{ path: string }> }> };

    expect(result.groups).toBeDefined();
    expect(result.groups.length).toBeGreaterThanOrEqual(2);
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
});
