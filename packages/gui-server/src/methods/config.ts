import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  BranchResolver,
  computeSnapshotFingerprint,
  getVersePath,
  TemplateRepository,
  TemplateService,
} from '@multiverse/core';
import type { SnapshotFile, Template } from '@multiverse/types';

type MethodHandler = (params: Record<string, unknown>) => Promise<unknown>;

interface ConfigFile {
  path: string;
  type: 'markdown' | 'json' | 'text';
}

interface ConfigGroup {
  label: string;
  basePath: string;
  files: ConfigFile[];
}

type RuntimePaths = {
  projectPath: string;
  homePath: string;
};

function detectFileType(filePath: string): ConfigFile['type'] {
  if (filePath.endsWith('.md')) return 'markdown';
  if (filePath.endsWith('.json')) return 'json';
  return 'text';
}

function getRuntimePaths(params: Record<string, unknown>): RuntimePaths {
  const projectPath =
    typeof params.projectPath === 'string'
      ? params.projectPath
      : (process.env.MULTIVERSE_GUI_PROJECT_PATH ?? process.cwd());
  const homePath =
    typeof params.homePath === 'string'
      ? params.homePath
      : (process.env.MULTIVERSE_GUI_HOME_PATH ?? os.homedir());

  return { homePath, projectPath };
}

function getTemplatesDir(homePath: string): string {
  return path.join(homePath, '.multiverse', 'templates');
}

function normalizeTemplateFilePath(filePath: string): string {
  return filePath === 'CLAUDE.md' ? filePath : filePath.replace(/^\.claude\//, '');
}

function toDisplayPath(snapshotPath: string): string {
  return snapshotPath === 'CLAUDE.md' ? snapshotPath : `.claude/${snapshotPath}`;
}

function templateFiles(template: Template): ConfigFile[] {
  const files: ConfigFile[] = [];
  if (template.snapshot.claudeMd !== undefined) {
    files.push({ path: 'CLAUDE.md', type: 'markdown' });
  }

  files.push(
    ...template.snapshot.files.map((file) => ({
      path: toDisplayPath(file.path),
      type: detectFileType(file.path),
    })),
  );

  return files;
}

async function findCurrentVerseTemplateId(projectPath: string): Promise<string | undefined> {
  try {
    const branch = await new BranchResolver().getCurrentBranch(projectPath);
    const versePath = getVersePath(projectPath, branch);
    const raw = await fs.readFile(versePath, 'utf8');
    const verse = JSON.parse(raw) as { templateId?: unknown };
    return typeof verse.templateId === 'string' ? verse.templateId : undefined;
  } catch {
    return undefined;
  }
}

async function findActiveTemplate(params: Record<string, unknown>): Promise<Template | undefined> {
  const { homePath, projectPath } = getRuntimePaths(params);
  const service = new TemplateService(getTemplatesDir(homePath));
  const verseTemplateId = await findCurrentVerseTemplateId(projectPath);

  if (verseTemplateId) {
    const verseTemplate = await service.findById(verseTemplateId);
    if (verseTemplate) {
      return verseTemplate;
    }
  }

  return service.findByName('default');
}

async function listFiles(params: Record<string, unknown>): Promise<{ groups: ConfigGroup[] }> {
  const template = await findActiveTemplate(params);
  if (template) {
    return {
      groups: [
        {
          label: `模板: ${template.name}`,
          basePath: template.id,
          files: templateFiles(template),
        },
      ],
    };
  }

  return { groups: [] };
}

async function readFile(params: Record<string, unknown>): Promise<{ content: string }> {
  const templateId = params.templateId;
  if (typeof templateId === 'string') {
    const { homePath } = getRuntimePaths(params);
    const template = await new TemplateService(getTemplatesDir(homePath)).findById(templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" not found`);
    }

    const filePath = normalizeTemplateFilePath(params.filePath as string);
    if (filePath === 'CLAUDE.md') {
      return { content: template.snapshot.claudeMd ?? '' };
    }

    const file = template.snapshot.files.find((entry) => entry.path === filePath);
    if (!file) {
      throw new Error(`Template file "${filePath}" not found`);
    }
    return { content: file.content };
  }

  const filePath = params.filePath as string;
  const content = await fs.readFile(filePath, 'utf8');
  return { content };
}

async function writeFile(params: Record<string, unknown>): Promise<{ success: boolean }> {
  const templateId = params.templateId;
  if (typeof templateId === 'string') {
    const { homePath } = getRuntimePaths(params);
    const repository = new TemplateRepository(getTemplatesDir(homePath));
    const template = await repository.findById(templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" not found`);
    }

    const filePath = normalizeTemplateFilePath(params.filePath as string);
    const content = params.content as string;
    if (filePath === 'CLAUDE.md') {
      template.snapshot.claudeMd = content;
    } else {
      const existingFile = template.snapshot.files.find((entry) => entry.path === filePath);
      if (existingFile) {
        existingFile.content = content;
      } else {
        const newFile: SnapshotFile = { path: filePath, content };
        template.snapshot.files.push(newFile);
      }
    }
    template.fingerprint = computeSnapshotFingerprint(template.snapshot);
    await repository.save(template);
    return { success: true };
  }

  const filePath = params.filePath as string;
  const content = params.content as string;
  await fs.writeFile(filePath, content, 'utf8');
  return { success: true };
}

export const configMethods: Record<string, MethodHandler> = {
  'config.listFiles': listFiles,
  'config.readFile': readFile,
  'config.writeFile': writeFile,
};
