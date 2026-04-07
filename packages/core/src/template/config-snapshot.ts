import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ConfigSnapshot, SnapshotFile } from '@multiverse/types';

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

  // Recursively read .claude/ directory
  const files = await readDirRecursive(claudeDir, claudeDir);

  return { claudeMd, files };
}

async function readDirRecursive(
  currentDir: string,
  baseDir: string,
): Promise<SnapshotFile[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files: SnapshotFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readDirRecursive(fullPath, baseDir)));
    } else if (entry.isFile()) {
      const relativePath = path.relative(baseDir, fullPath);
      const content = await fs.readFile(fullPath, 'utf8');
      files.push({ path: relativePath, content });
    }
  }

  return files;
}
