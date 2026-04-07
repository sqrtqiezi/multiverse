import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Template } from '@multiverse/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TemplateRepository } from '../template-repository.js';

function createTestTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'tpl-test-001',
    name: 'test-template',
    snapshot: {
      claudeMd: '# Test',
      files: [{ path: 'settings.json', content: '{}' }],
    },
    createdAt: '2026-04-07T10:00:00.000Z',
    ...overrides,
  };
}

describe('TemplateRepository', () => {
  let tempDir: string;
  let repo: TemplateRepository;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-tpl-repo-'));
    repo = new TemplateRepository(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('saves a template and reads it back by id', async () => {
    const tpl = createTestTemplate();
    await repo.save(tpl);
    const loaded = await repo.findById(tpl.id);

    expect(loaded).toEqual(tpl);
  });

  it('returns undefined when template id does not exist', async () => {
    const result = await repo.findById('nonexistent');
    expect(result).toBeUndefined();
  });

  it('saves template as JSON file named <id>.json', async () => {
    const tpl = createTestTemplate();
    await repo.save(tpl);

    const filePath = path.join(tempDir, `${tpl.id}.json`);
    const raw = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(raw)).toEqual(tpl);
  });

  it('finds a template by name', async () => {
    const tpl = createTestTemplate({ id: 'tpl-by-name', name: 'my-env' });
    await repo.save(tpl);
    const loaded = await repo.findByName('my-env');

    expect(loaded).toEqual(tpl);
  });

  it('returns undefined when template name does not exist', async () => {
    const result = await repo.findByName('nonexistent');
    expect(result).toBeUndefined();
  });

  it('lists all templates sorted by createdAt descending', async () => {
    const tpl1 = createTestTemplate({
      id: 'tpl-1',
      name: 'first',
      createdAt: '2026-04-06T10:00:00.000Z',
    });
    const tpl2 = createTestTemplate({
      id: 'tpl-2',
      name: 'second',
      createdAt: '2026-04-07T10:00:00.000Z',
    });
    await repo.save(tpl1);
    await repo.save(tpl2);
    const all = await repo.listAll();

    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('tpl-2');
    expect(all[1].id).toBe('tpl-1');
  });

  it('returns empty array when no templates exist', async () => {
    const all = await repo.listAll();
    expect(all).toEqual([]);
  });
});
