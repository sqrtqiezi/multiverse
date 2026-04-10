import * as fs from 'node:fs/promises';
import * as path from 'node:path';

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

function detectFileType(filePath: string): ConfigFile['type'] {
  if (filePath.endsWith('.md')) return 'markdown';
  if (filePath.endsWith('.json')) return 'json';
  return 'text';
}

async function scanConfigFiles(basePath: string): Promise<ConfigFile[]> {
  const files: ConfigFile[] = [];

  try {
    const claudeMdPath = path.join(basePath, 'CLAUDE.md');
    await fs.access(claudeMdPath);
    files.push({ path: 'CLAUDE.md', type: 'markdown' });
  } catch {
    // CLAUDE.md doesn't exist
  }

  const claudeDir = path.join(basePath, '.claude');
  try {
    const entries = await scanDirRecursive(claudeDir, claudeDir);
    files.push(...entries);
  } catch {
    // .claude dir doesn't exist
  }

  return files;
}

const EXCLUDED = new Set([
  'projects',
  'teams',
  'tasks',
  'worktrees',
  'memory',
  'file-history',
  'usage-data',
  'telemetry',
  'paste-cache',
  'session-env',
  'todos',
  'backups',
  'shell-snapshots',
  'sessions',
  'plans',
  'cache',
  'plugins',
]);

async function scanDirRecursive(dir: string, baseDir: string): Promise<ConfigFile[]> {
  const files: ConfigFile[] = [];

  let entries: Awaited<ReturnType<typeof fs.readdir<{ withFileTypes: true }>>>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const relativePath = path.relative(baseDir, path.join(dir, entry.name));
    const topSegment = relativePath.split(path.sep)[0] ?? '';

    if (entry.isDirectory()) {
      if (EXCLUDED.has(topSegment)) continue;
      files.push(...(await scanDirRecursive(path.join(dir, entry.name), baseDir)));
    } else if (entry.isFile()) {
      files.push({
        path: `.claude/${relativePath}`,
        type: detectFileType(entry.name),
      });
    }
  }

  return files;
}

async function listFiles(params: Record<string, unknown>): Promise<{ groups: ConfigGroup[] }> {
  const projectPath = params.projectPath as string;
  const homePath = params.homePath as string;

  const [projectFiles, globalFiles] = await Promise.all([
    scanConfigFiles(projectPath),
    scanConfigFiles(homePath),
  ]);

  const groups: ConfigGroup[] = [
    { label: '项目配置', basePath: projectPath, files: projectFiles },
    { label: '全局配置', basePath: homePath, files: globalFiles },
  ];

  return { groups };
}

async function readFile(params: Record<string, unknown>): Promise<{ content: string }> {
  const filePath = params.filePath as string;
  const content = await fs.readFile(filePath, 'utf8');
  return { content };
}

async function writeFile(params: Record<string, unknown>): Promise<{ success: boolean }> {
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
