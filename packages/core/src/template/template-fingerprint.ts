import { createHash } from 'node:crypto';
import type { ConfigSnapshot } from '@multiverse/types';
import { createConfigSnapshot } from './config-snapshot.js';

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function buildSnapshotEntries(snapshot: ConfigSnapshot): Array<{ path: string; content: string }> {
  const entries = snapshot.files
    .map((file) => ({
      path: normalizePath(file.path),
      content: normalizeLineEndings(file.content),
    }))
    .concat(
      snapshot.claudeMd === undefined
        ? []
        : [
            {
              path: 'CLAUDE.md',
              content: normalizeLineEndings(snapshot.claudeMd),
            },
          ],
    )
    .sort((a, b) => {
      if (a.path < b.path) return -1;
      if (a.path > b.path) return 1;
      if (a.content < b.content) return -1;
      if (a.content > b.content) return 1;
      return 0;
    });

  return entries;
}

export function computeSnapshotFingerprint(snapshot: ConfigSnapshot): string {
  const hash = createHash('sha256');
  const entries = buildSnapshotEntries(snapshot);

  for (const entry of entries) {
    hash.update(entry.path, 'utf8');
    hash.update('\n', 'utf8');
    hash.update(entry.content, 'utf8');
    hash.update('\n', 'utf8');
  }

  return hash.digest('hex');
}

export async function computeCurrentConfigFingerprint(homeDir: string): Promise<{
  fingerprint: string;
  snapshot: ConfigSnapshot;
}> {
  const snapshot = await createConfigSnapshot(homeDir);
  return {
    fingerprint: computeSnapshotFingerprint(snapshot),
    snapshot,
  };
}
