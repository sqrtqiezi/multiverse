import * as path from 'node:path';

export const CLAUDE_HOME_CONTAINER_PATH = '/home/coder';

export function getVerseEnvironmentHostPath(projectRoot: string, verseId: string): string {
  return path.join(projectRoot, '.multiverse', 'verse-envs', verseId, 'home');
}
