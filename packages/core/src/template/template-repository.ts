import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Template } from '@multiverse/types';
import { computeSnapshotFingerprint } from './template-fingerprint.js';

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
      return this.hydrateTemplate(JSON.parse(raw) as Partial<Template>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  async findByName(name: string): Promise<Template | undefined> {
    const all = await this.listAll();
    return all.find((t) => t.name === name);
  }

  async listAll(): Promise<Template[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.templatesDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const templates: Template[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const filePath = path.join(this.templatesDir, entry);
      const raw = await fs.readFile(filePath, 'utf8');
      templates.push(this.hydrateTemplate(JSON.parse(raw) as Partial<Template>));
    }

    return templates.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  private hydrateTemplate(template: Partial<Template>): Template {
    if (!template.snapshot) {
      return template as Template;
    }

    return {
      ...template,
      fingerprint: template.fingerprint ?? computeSnapshotFingerprint(template.snapshot),
    } as Template;
  }
}
