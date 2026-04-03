import { createHash } from 'node:crypto';
import * as path from 'node:path';

export function sanitizeBranchName(branch: string): string {
  return branch
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
}

export function toVerseFileName(branch: string): string {
  const normalizedBranch = sanitizeBranchName(branch);
  const digest = createHash('sha1').update(branch).digest('hex').slice(0, 8);
  return `${normalizedBranch}__${digest}.json`;
}

export function getVersesDir(projectRoot: string): string {
  return path.join(projectRoot, '.multiverse', 'verses');
}

export function getVersePath(projectRoot: string, branch: string): string {
  return path.join(getVersesDir(projectRoot), toVerseFileName(branch));
}
