import * as os from 'node:os';
import * as path from 'node:path';
import { TemplateService } from '@multiverse/core';
import type { Template } from '@multiverse/types';
import { Command } from 'commander';

function getDefaultTemplatesDir(): string {
  return path.join(os.homedir(), '.multiverse', 'templates');
}

type CreateInput = {
  name: string;
  homeDir: string;
  templatesDir: string;
  description?: string;
};

type ListInput = {
  templatesDir: string;
  json?: boolean;
};

export function createTemplateHandler() {
  return {
    async create({ name, homeDir, templatesDir, description }: CreateInput): Promise<Template> {
      const service = new TemplateService(templatesDir);
      return service.create({ name, homeDir, description });
    },

    async list({ templatesDir, json }: ListInput): Promise<Template[]> {
      const service = new TemplateService(templatesDir);
      return service.list();
    },
  };
}

export function createTemplateCommand() {
  const handler = createTemplateHandler();
  const command = new Command('template').description('Manage configuration templates');

  command
    .command('create <name>')
    .description('Create a template from current global configuration')
    .option('--description <desc>', 'Template description')
    .action(async (name: string, opts: { description?: string }) => {
      const homeDir = os.homedir();
      const templatesDir = getDefaultTemplatesDir();
      try {
        const tpl = await handler.create({
          name,
          homeDir,
          templatesDir,
          description: opts.description,
        });
        console.log(`✓ Template "${tpl.name}" created (id: ${tpl.id})`);
      } catch (error) {
        console.error(`✗ ${(error as Error).message}`);
        process.exit(1);
      }
    });

  command
    .command('list')
    .description('List all templates')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const templatesDir = getDefaultTemplatesDir();
      const templates = await handler.list({ templatesDir, json: opts.json });

      if (opts.json) {
        console.log(JSON.stringify(templates, null, 2));
        return;
      }

      if (templates.length === 0) {
        console.log('No templates found. Create one with: multiverse template create <name>');
        return;
      }

      console.log(`${'Name'.padEnd(30)} ${'ID'.padEnd(38)} ${'Created At'}`);
      console.log('─'.repeat(80));
      for (const tpl of templates) {
        const created = new Date(tpl.createdAt).toLocaleString();
        console.log(`${tpl.name.padEnd(30)} ${tpl.id.padEnd(38)} ${created}`);
      }
    });

  return { command, handler };
}
