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
});
