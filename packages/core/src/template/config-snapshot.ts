import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ConfigSnapshot, SnapshotFile } from '@multiverse/types';

// Claude Code internal runtime directories — not user configuration
const EXCLUDED_DIRS = new Set([
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
  'plugins/marketplaces',
  'plugins/data',
]);

// Files at the top level of .claude/ that should be excluded
const EXCLUDED_FILES = new Set(['history.jsonl']);

function isExcludedPath(relativePath: string): boolean {
  // Exclude .git directories at any depth
  const segments = relativePath.split(path.sep);
  if (segments.includes('.git')) {
    return true;
  }
  // Check exact directory match or prefix match (e.g. "plugins/data" matches "plugins/data/foo")
  for (const excluded of EXCLUDED_DIRS) {
    if (relativePath === excluded || relativePath.startsWith(`${excluded}/`)) {
      return true;
    }
  }
  return false;
}

function isExcludedFile(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  if (EXCLUDED_FILES.has(relativePath)) return true;
  // Skip vim swap files and backup files
  if (basename.startsWith('.') && basename.endsWith('.swp')) return true;
  if (basename.endsWith('.bak')) return true;
  return false;
}

function sanitizeSettings(content: string): string {
  try {
    const settings = JSON.parse(content);
    delete settings.hooks;
    return JSON.stringify(settings, null, 2);
  } catch {
    return content;
  }
}

export async function createConfigSnapshot(homeDir: string): Promise<ConfigSnapshot> {
  const claudeDir = path.join(homeDir, '.claude');

  // Verify .claude/ exists
  await fs.access(claudeDir);

  // Read CLAUDE.md if present
  let claudeMd: string | undefined;
  try {
    claudeMd = await fs.readFile(path.join(homeDir, 'CLAUDE.md'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  // Recursively read .claude/ directory, skipping internal runtime dirs
  const files = await readDirRecursive(claudeDir, claudeDir);

  return { claudeMd, files };
}

async function readDirRecursive(currentDir: string, baseDir: string): Promise<SnapshotFile[]> {
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      return [];
    }
    throw error;
  }

  const files: SnapshotFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (isExcludedPath(relativePath)) {
        continue;
      }
      files.push(...(await readDirRecursive(fullPath, baseDir)));
    } else if (entry.isFile()) {
      if (isExcludedFile(relativePath)) {
        continue;
      }
      try {
        let content = await fs.readFile(fullPath, 'utf8');
        if (relativePath === 'settings.json') {
          content = sanitizeSettings(content);
        }
        files.push({ path: relativePath, content });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          continue;
        }
        throw error;
      }
    }
  }

  return files;
}
