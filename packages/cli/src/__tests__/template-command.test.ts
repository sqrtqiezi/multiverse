import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTemplateCommand } from '../commands/template.js';

describe('template create command', () => {
  let tempHome: string;
  let templatesDir: string;

  beforeEach(async () => {
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'mv-tpl-cmd-'));
    templatesDir = path.join(tempHome, '.multiverse', 'templates');

    // Set up a valid home directory
    const claudeDir = path.join(tempHome, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(tempHome, 'CLAUDE.md'), '# CLI Test');
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{}');
  });

  afterEach(async () => {
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it('creates a template and writes it to disk', async () => {
    const { handler } = createTemplateCommand();
    await handler.create({
      name: 'cli-test',
      homeDir: tempHome,
      templatesDir,
    });

    const files = await fs.readdir(templatesDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.json$/);
  });

  it('creates a template with description', async () => {
    const { handler } = createTemplateCommand();
    await handler.create({
      name: 'with-desc',
      homeDir: tempHome,
      templatesDir,
      description: 'A test template',
    });

    const files = await fs.readdir(templatesDir);
    const raw = await fs.readFile(path.join(templatesDir, files[0]), 'utf8');
    const tpl = JSON.parse(raw);
    expect(tpl.description).toBe('A test template');
  });
});
