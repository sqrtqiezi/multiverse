import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VerseRepository } from '../verse-repository.js';

describe('VerseRepository', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multiverse-verse-repo-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('acquires a lock and writes a verse atomically', async () => {
    const repository = new VerseRepository(tempDir);
    const branch = 'main';
    const normalizedBranch = branch.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
    const digest = createHash('sha1').update(branch).digest('hex').slice(0, 8);
    const versePath = path.join(
      tempDir,
      '.multiverse',
      'verses',
      `${normalizedBranch}__${digest}.json`,
    );

    const result = await repository.writeVerse({
      branch,
      mutate: (verse) => {
        verse.runs.push({
          runId: 'run-1',
          startAt: '2026-04-02T00:00:00.000Z',
        });
      },
    });
    const persisted = await repository.readVerse(versePath);

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].runId).toBe('run-1');
    expect(result.runs[0].startAt).toBe('2026-04-02T00:00:00.000Z');
    expect(persisted.runs).toHaveLength(1);
    expect(persisted.runs[0].runId).toBe('run-1');
  });

  it('throws VerseLockTimeoutError when the lock cannot be acquired in 3 seconds', async () => {
    const repository = new VerseRepository(tempDir);
    const branch = 'feature/lock-competition';
    const normalizedBranch = branch.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
    const digest = createHash('sha1').update(branch).digest('hex').slice(0, 8);
    const verseDir = path.join(tempDir, '.multiverse', 'verses');
    const lockPath = path.join(verseDir, `${normalizedBranch}__${digest}.json.lock`);

    await fs.mkdir(verseDir, { recursive: true });
    await fs.writeFile(
      lockPath,
      JSON.stringify({
        pid: process.pid,
        host: os.hostname(),
        createdAt: new Date().toISOString(),
      }),
    );

    const writePromise = repository.writeVerse({
      branch,
      mutate: (verse) => {
        verse.runs.push({
          runId: 'run-1',
          startAt: '2026-04-02T00:00:00.000Z',
        });
      },
    });

    await expect(writePromise).rejects.toMatchObject({ name: 'VerseLockTimeoutError' });
  });

  it('throws VerseCorruptedError and does not overwrite corrupted files', async () => {
    const repository = new VerseRepository(tempDir);
    const versePath = path.join(tempDir, 'corrupted.json');

    await fs.writeFile(versePath, '{not-json');
    const originalContent = await fs.readFile(versePath, 'utf8');

    await expect(repository.readVerse(versePath)).rejects.toMatchObject({
      name: 'VerseCorruptedError',
    });
    expect(await fs.readFile(versePath, 'utf8')).toBe(originalContent);
  });
});
