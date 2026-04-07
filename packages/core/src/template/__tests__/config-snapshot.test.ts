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
    expect(snapshot.files[0].content).toBe('{"key": "value"}');
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
});
