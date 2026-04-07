import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PersistedVerse, PersistedVerseV1, Verse } from '@multiverse/types';
import { VerseCorruptedError, VerseLockTimeoutError } from './errors.js';
import { CLAUDE_HOME_CONTAINER_PATH, getVerseEnvironmentHostPath } from './claude-home.js';
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
    return this.normalizeVerse(this.parseVerse(rawContent, versePath));
  }

  async writeVerse({ branch, mutate }: WriteVerseInput): Promise<Verse> {
    const versePath = getVersePath(this.projectRoot, branch);
    const lockPath = `${versePath}.lock`;

    await fs.mkdir(path.dirname(versePath), { recursive: true });
    await this.acquireLock(lockPath);

    try {
      const verse = await this.loadOrCreateVerse(versePath, branch);
      verse.branch = branch;
      await fs.mkdir(verse.environment.hostPath, { recursive: true });
      await fs.chmod(verse.environment.hostPath, 0o777);
      await fs.mkdir(path.join(verse.environment.hostPath, '.claude'), { recursive: true });
      await fs.chmod(path.join(verse.environment.hostPath, '.claude'), 0o777);
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
        return this.createVerse(branch);
      }

      throw error;
    }
  }

  private createVerse(branch: string): Verse {
    const now = new Date().toISOString();
    const id = randomUUID();

    return {
      schemaVersion: 2,
      id,
      branch,
      projectRoot: this.projectRoot,
      environment: {
        hostPath: getVerseEnvironmentHostPath(this.projectRoot, id),
        containerPath: CLAUDE_HOME_CONTAINER_PATH,
        initializedAt: now,
      },
      createdAt: now,
      updatedAt: now,
      runs: [],
    };
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

  private parseVerse(rawContent: string, versePath: string): PersistedVerse {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new VerseCorruptedError(`Verse file is corrupted: ${versePath}`);
    }

    if (!this.isPersistedVerse(parsed)) {
      throw new VerseCorruptedError(`Verse file is corrupted: ${versePath}`);
    }

    return parsed;
  }

  private normalizeVerse(verse: PersistedVerse): Verse {
    return this.normalizeVerseForBranch(verse, verse.branch);
  }

  private normalizeVerseForBranch(verse: PersistedVerse, branch: string): Verse {
    const initializedAt =
      verse.schemaVersion === 2 ? verse.environment.initializedAt : verse.createdAt;
    const activeProjectRoot = this.projectRoot;

    return {
      schemaVersion: 2,
      id: verse.id,
      branch,
      projectRoot: activeProjectRoot,
      environment: {
        hostPath: getVerseEnvironmentHostPath(activeProjectRoot, verse.id),
        containerPath: CLAUDE_HOME_CONTAINER_PATH,
        initializedAt,
      },
      createdAt: verse.createdAt,
      updatedAt: verse.updatedAt,
      runs: verse.runs,
    };
  }

  private isPersistedVerse(value: unknown): value is PersistedVerse {
    return this.isPersistedVerseV1(value) || this.isPersistedVerseV2(value);
  }

  private isPersistedVerseV1(value: unknown): value is PersistedVerseV1 {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<PersistedVerseV1>;

    return (
      candidate.schemaVersion === 1 &&
      typeof candidate.id === 'string' &&
      typeof candidate.branch === 'string' &&
      typeof candidate.createdAt === 'string' &&
      typeof candidate.updatedAt === 'string' &&
      Array.isArray(candidate.runs) &&
      candidate.runs.every((run) => this.isRunRecord(run))
    );
  }

  private isPersistedVerseV2(value: unknown): value is Verse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<Verse>;
    const environment = candidate.environment;

    return (
      candidate.schemaVersion === 2 &&
      typeof candidate.id === 'string' &&
      typeof candidate.branch === 'string' &&
      typeof candidate.projectRoot === 'string' &&
      typeof candidate.createdAt === 'string' &&
      typeof candidate.updatedAt === 'string' &&
      Array.isArray(candidate.runs) &&
      candidate.runs.every((run) => this.isRunRecord(run)) &&
      typeof environment === 'object' &&
      environment !== null &&
      typeof environment.hostPath === 'string' &&
      typeof environment.containerPath === 'string' &&
      typeof environment.initializedAt === 'string'
    );
  }

  private isRunRecord(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as {
      runId?: unknown;
      startAt?: unknown;
      endAt?: unknown;
      exitCode?: unknown;
      containerId?: unknown;
    };

    return (
      typeof candidate.runId === 'string' &&
      typeof candidate.startAt === 'string' &&
      (candidate.endAt === undefined || typeof candidate.endAt === 'string') &&
      (candidate.exitCode === undefined || typeof candidate.exitCode === 'number') &&
      (candidate.containerId === undefined || typeof candidate.containerId === 'string')
    );
  }
}
