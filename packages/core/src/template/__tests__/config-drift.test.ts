import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Template } from '@multiverse/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeSnapshotFingerprint } from '../template-fingerprint.js';
import { checkTemplateDrift } from '../config-drift.js';

const SETTINGS_JSON = '{\n  "alpha": 1\n}';

function createTemplate(overrides: Partial<Template> = {}): Template {
  const template: Template = {
    id: 'tpl-001',
    name: 'base-template',
    snapshot: {
      claudeMd: '# Base\nline 2',
      files: [
        { path: 'settings.json', content: SETTINGS_JSON },
        { path: 'notes.txt', content: 'keep' },
      ],
    },
    fingerprint: computeSnapshotFingerprint({
      claudeMd: '# Base\nline 2',
      files: [
        { path: 'settings.json', content: SETTINGS_JSON },
        { path: 'notes.txt', content: 'keep' },
      ],
    }),
    createdAt: '2026-04-09T10:00:00.000Z',
    ...overrides,
  };

  return template;
}

describe('checkTemplateDrift', () => {
  let tempHome: string;

  beforeEach(async () => {
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-drift-'));
    await fs.mkdir(path.join(tempHome, '.claude'), { recursive: true });
    await fs.writeFile(path.join(tempHome, 'CLAUDE.md'), '# Base\nline 2');
    await fs.writeFile(path.join(tempHome, '.claude', 'settings.json'), '{"alpha":1}');
    await fs.writeFile(path.join(tempHome, '.claude', 'notes.txt'), 'keep');
  });

  afterEach(async () => {
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it('reports no drift for identical snapshots', async () => {
    const result = await checkTemplateDrift({
      homeDir: tempHome,
      template: createTemplate(),
    });

    expect(result.isDrifted).toBe(false);
    expect(result.addedFiles).toEqual([]);
    expect(result.modifiedFiles).toEqual([]);
    expect(result.removedFiles).toEqual([]);
    expect(result.templateFingerprint).toBe(createTemplate().fingerprint);
    expect(result.currentFingerprint).toBe(
      computeSnapshotFingerprint({
        claudeMd: '# Base\nline 2',
        files: [
          { path: 'notes.txt', content: 'keep' },
          { path: 'settings.json', content: SETTINGS_JSON },
        ],
      }),
    );
  });

  it('normalizes CLAUDE.md line endings when comparing snapshots', async () => {
    await fs.writeFile(path.join(tempHome, 'CLAUDE.md'), '# Base\r\nline 2');

    const result = await checkTemplateDrift({
      homeDir: tempHome,
      template: createTemplate(),
    });

    expect(result.isDrifted).toBe(false);
    expect(result.modifiedFiles).toEqual([]);
    expect(result.addedFiles).toEqual([]);
    expect(result.removedFiles).toEqual([]);
  });

  it('reports added, modified, and removed files using logical paths', async () => {
    await fs.writeFile(path.join(tempHome, '.claude', 'added.txt'), 'new file');
    await fs.writeFile(path.join(tempHome, '.claude', 'notes.txt'), 'changed');
    await fs.rm(path.join(tempHome, '.claude', 'settings.json'));

    const result = await checkTemplateDrift({
      homeDir: tempHome,
      template: createTemplate(),
    });

    expect(result.isDrifted).toBe(true);
    expect(result.addedFiles).toEqual(['.claude/added.txt']);
    expect(result.modifiedFiles).toEqual(['.claude/notes.txt']);
    expect(result.removedFiles).toEqual(['.claude/settings.json']);
  });

  it('reports CLAUDE.md drift when content changes', async () => {
    await fs.writeFile(path.join(tempHome, 'CLAUDE.md'), '# Updated\nline 2');

    const result = await checkTemplateDrift({
      homeDir: tempHome,
      template: createTemplate(),
    });

    expect(result.isDrifted).toBe(true);
    expect(result.modifiedFiles).toEqual(['CLAUDE.md']);
  });
});
