import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Template } from '@multiverse/types';

export class TemplateRepository {
  constructor(private readonly templatesDir: string) {}

  async save(template: Template): Promise<void> {
    await fs.mkdir(this.templatesDir, { recursive: true });
    const filePath = path.join(this.templatesDir, `${template.id}.json`);
    await fs.writeFile(filePath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  }

  async findById(id: string): Promise<Template | undefined> {
    const filePath = path.join(this.templatesDir, `${id}.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw) as Template;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }
}
