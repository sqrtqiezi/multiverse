import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ConfigSnapshot } from '@multiverse/types';
import { CLAUDE_HOME_CONTAINER_PATH } from '../verse/claude-home.js';

function rewriteClaudePath(absolutePath: string): string {
  const marker = '/.claude/';
  const idx = absolutePath.indexOf(marker);
  if (idx === -1) {
    return absolutePath;
  }
  return `${CLAUDE_HOME_CONTAINER_PATH}/.claude/${absolutePath.slice(idx + marker.length)}`;
}

function rewriteInstalledPlugins(content: string): string {
  try {
    const data = JSON.parse(content);
    if (data.plugins && typeof data.plugins === 'object') {
      for (const entries of Object.values(data.plugins)) {
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          if (typeof entry.installPath === 'string') {
            entry.installPath = rewriteClaudePath(entry.installPath);
          }
        }
      }
    }
    return JSON.stringify(data, null, 2);
  } catch {
    return content;
  }
}

function rewriteKnownMarketplaces(content: string): string {
  try {
    const data = JSON.parse(content);
    for (const marketplace of Object.values(data)) {
      if (
        marketplace &&
        typeof marketplace === 'object' &&
        'installLocation' in marketplace &&
        typeof (marketplace as Record<string, unknown>).installLocation === 'string'
      ) {
        const loc = (marketplace as Record<string, unknown>).installLocation as string;
        (marketplace as Record<string, unknown>).installLocation = rewriteClaudePath(loc);
      }
    }
    return JSON.stringify(data, null, 2);
  } catch {
    return content;
  }
}

function transformFileContent(filePath: string, content: string): string {
  if (filePath === 'plugins/installed_plugins.json') {
    return rewriteInstalledPlugins(content);
  }
  if (filePath === 'plugins/known_marketplaces.json') {
    return rewriteKnownMarketplaces(content);
  }
  return content;
}

export async function injectTemplateSnapshot(
  verseHomePath: string,
  snapshot: ConfigSnapshot,
): Promise<void> {
  if (snapshot.claudeMd !== undefined) {
    await fs.writeFile(path.join(verseHomePath, 'CLAUDE.md'), snapshot.claudeMd, 'utf8');
  }

  const claudeDir = path.join(verseHomePath, '.claude');

  for (const file of snapshot.files) {
    if (file.path.includes('..') || path.isAbsolute(file.path)) {
      continue;
    }

    const targetPath = path.join(claudeDir, file.path);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const content = transformFileContent(file.path, file.content);
    await fs.writeFile(targetPath, content, 'utf8');
  }
}
