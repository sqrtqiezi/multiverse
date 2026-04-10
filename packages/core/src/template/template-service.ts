import { randomUUID } from 'node:crypto';
import type { Template } from '@multiverse/types';
import { createConfigSnapshot } from './config-snapshot.js';
import { computeSnapshotFingerprint } from './template-fingerprint.js';
import { TemplateRepository } from './template-repository.js';
import { TemplateValidator } from './template-validator.js';

type CreateTemplateInput = {
  name: string;
  homeDir: string;
  description?: string;
};

type CreateSyncedTemplateInput = {
  baseTemplateName: string;
  homeDir: string;
};

export class TemplateService {
  private readonly repository: TemplateRepository;
  private readonly validator: TemplateValidator;

  constructor(templatesDir: string) {
    this.repository = new TemplateRepository(templatesDir);
    this.validator = new TemplateValidator();
  }

  async create({ name, homeDir, description }: CreateTemplateInput): Promise<Template> {
    return this.createTemplate({ name, homeDir, description });
  }

  async createSyncedTemplate({
    baseTemplateName,
    homeDir,
  }: CreateSyncedTemplateInput): Promise<Template> {
    return this.createTemplate({
      name: `${baseTemplateName}-sync-${new Date().toISOString()}`,
      homeDir,
    });
  }

  private async createTemplate({ name, homeDir, description }: CreateTemplateInput): Promise<Template> {
    const existing = await this.repository.findByName(name);
    if (existing) {
      throw new Error(`Template with name "${name}" already exists (id: ${existing.id})`);
    }

    const snapshot = await createConfigSnapshot(homeDir);
    const fingerprint = computeSnapshotFingerprint(snapshot);

    const template: Template = {
      id: randomUUID(),
      name,
      description,
      snapshot,
      fingerprint,
      createdAt: new Date().toISOString(),
    };

    const formatResult = this.validator.validateFormat(template);
    if (!formatResult.valid) {
      throw new Error(`Template format validation failed: ${formatResult.error}`);
    }

    const integrityResult = this.validator.validateIntegrity(template);
    if (!integrityResult.valid) {
      throw new Error(`Template integrity validation failed: ${integrityResult.error}`);
    }

    await this.repository.save(template);
    return template;
  }

  async list(): Promise<Template[]> {
    return this.repository.listAll();
  }

  async findByName(name: string): Promise<Template | undefined> {
    return this.repository.findByName(name);
  }

  async findById(id: string): Promise<Template | undefined> {
    return this.repository.findById(id);
  }
}
