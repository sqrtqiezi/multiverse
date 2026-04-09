import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TemplateService } from '../template-service.js';

describe('TemplateService', () => {
  let tempHome: string;
  let templatesDir: string;
  let service: TemplateService;

  beforeEach(async () => {
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-tpl-svc-'));
    templatesDir = path.join(tempHome, '.multiverse', 'templates');
    service = new TemplateService(templatesDir);

    // Set up a valid ~/.claude/ directory
    const claudeDir = path.join(tempHome, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(tempHome, 'CLAUDE.md'), '# Test Config');
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{"key":"val"}');
  });

  afterEach(async () => {
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it('creates a template from home directory', async () => {
    const tpl = await service.create({ name: 'my-env', homeDir: tempHome });

    expect(tpl.name).toBe('my-env');
    expect(tpl.id).toBeTypeOf('string');
    expect(tpl.snapshot.claudeMd).toBe('# Test Config');
    expect(tpl.snapshot.files).toHaveLength(1);
    expect(tpl.snapshot.files[0].path).toBe('settings.json');
  });

  it('creates a template with description', async () => {
    const tpl = await service.create({
      name: 'my-env',
      homeDir: tempHome,
      description: 'My description',
    });

    expect(tpl.description).toBe('My description');
  });

  it('rejects duplicate template name', async () => {
    await service.create({ name: 'dup-name', homeDir: tempHome });

    await expect(service.create({ name: 'dup-name', homeDir: tempHome })).rejects.toThrow(
      /already exists/,
    );
  });

  it('lists all templates', async () => {
    await service.create({ name: 'env-a', homeDir: tempHome });
    await service.create({ name: 'env-b', homeDir: tempHome });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('finds a template by name', async () => {
    await service.create({ name: 'find-me', homeDir: tempHome });

    const found = await service.findByName('find-me');
    expect(found?.name).toBe('find-me');
  });
});
