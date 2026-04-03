import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Verse } from '@multiverse/types';
import { VerseCorruptedError, VerseLockTimeoutError } from './errors.js';
import { getVersePath } from './verse-path.js';

type WriteVerseInput = {
  branch: string;
  mutate: (verse: Verse) => void | Promise<void>;
};

const LOCK_TIMEOUT_MS = 3000;
const LOCK_RETRY_MS = 50;

export class VerseRepository {
  constructor(private readonly projectRoot: string) {}

  async readVerse(versePath: string): Promise<Verse> {
    const rawContent = await fs.readFile(versePath, 'utf8');
    return this.parseVerse(rawContent, versePath);
  }

  async writeVerse({ branch, mutate }: WriteVerseInput): Promise<Verse> {
    const versePath = getVersePath(this.projectRoot, branch);
    const lockPath = `${versePath}.lock`;

    await fs.mkdir(path.dirname(versePath), { recursive: true });
    await this.acquireLock(lockPath);

    try {
      const verse = await this.loadOrCreateVerse(versePath, branch);
      await mutate(verse);
      verse.updatedAt = new Date().toISOString();
      await this.atomicWriteVerse(versePath, verse);
      return verse;
    } finally {
      await fs.rm(lockPath, { force: true }).catch(() => undefined);
    }
  }

  private async loadOrCreateVerse(versePath: string, branch: string): Promise<Verse> {
    try {
      return await this.readVerse(versePath);
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        const now = new Date().toISOString();
        return {
          schemaVersion: 1,
          id: randomUUID(),
          branch,
          createdAt: now,
          updatedAt: now,
          runs: [],
        };
      }

      throw error;
    }
  }

  private async atomicWriteVerse(versePath: string, verse: Verse): Promise<void> {
    const tempPath = `${versePath}.${process.pid}.${randomUUID()}.tmp`;
    const serializedVerse = `${JSON.stringify(verse, null, 2)}\n`;

    try {
      await fs.writeFile(tempPath, serializedVerse, 'utf8');
      await fs.rename(tempPath, versePath);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async acquireLock(lockPath: string): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < LOCK_TIMEOUT_MS) {
      if (await this.tryAcquireLock(lockPath)) {
        return;
      }

      await this.delay(LOCK_RETRY_MS);
    }

    throw new VerseLockTimeoutError();
  }

  private isLockExistsError(error: unknown): boolean {
    return error instanceof Error && (error as NodeJS.ErrnoException).code === 'EEXIST';
  }

  private async tryAcquireLock(lockPath: string): Promise<boolean> {
    try {
      const handle = await fs.open(lockPath, 'wx');
      await handle.close();
      return true;
    } catch (error) {
      if (!this.isLockExistsError(error)) {
        throw error;
      }

      return false;
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private parseVerse(rawContent: string, versePath: string): Verse {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new VerseCorruptedError(`Verse file is corrupted: ${versePath}`);
    }

    if (!this.isVerse(parsed)) {
      throw new VerseCorruptedError(`Verse file is corrupted: ${versePath}`);
    }

    return parsed;
  }

  private isVerse(value: unknown): value is Verse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<Verse>;

    return (
      candidate.schemaVersion === 1 &&
      typeof candidate.id === 'string' &&
      typeof candidate.branch === 'string' &&
      typeof candidate.createdAt === 'string' &&
      typeof candidate.updatedAt === 'string' &&
      Array.isArray(candidate.runs)
    );
  }
}
