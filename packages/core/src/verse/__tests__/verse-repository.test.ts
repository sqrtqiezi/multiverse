import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLAUDE_HOME_CONTAINER_PATH, getVerseEnvironmentHostPath } from '../claude-home.js';
import { getVersePath } from '../verse-path.js';
import { VerseRepository } from '../verse-repository.js';

describe('VerseRepository', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multiverse-verse-repo-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes a verse when no lock contention exists', async () => {
    const repository = new VerseRepository(tempDir);
    const branch = 'main';
    const versePath = getVersePath(tempDir, branch);

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

  it('creates a schema v2 verse with environment metadata', async () => {
    const repository = new VerseRepository(tempDir);
    const branch = 'main';

    const verse = await repository.writeVerse({
      branch,
      mutate: () => undefined,
    });

    expect(verse.schemaVersion).toBe(2);
    expect(verse.projectRoot).toBe(tempDir);
    expect(verse.branch).toBe(branch);
    expect(verse.environment.hostPath).toBe(getVerseEnvironmentHostPath(tempDir, verse.id));
    expect(verse.environment.containerPath).toBe(CLAUDE_HOME_CONTAINER_PATH);
    expect(verse.environment.initializedAt).toBeTypeOf('string');
    expect(verse.runs).toEqual([]);
    expect((await fs.stat(verse.environment.hostPath)).isDirectory()).toBe(true);
    expect((await fs.stat(path.join(verse.environment.hostPath, '.claude'))).isDirectory()).toBe(
      true,
    );
  });

  it('creates a verse environment directory that is writable for the container user', async () => {
    const repository = new VerseRepository(tempDir);

    const verse = await repository.writeVerse({
      branch: 'main',
      mutate: () => undefined,
    });
    const stats = await fs.stat(verse.environment.hostPath);

    expect(stats.isDirectory()).toBe(true);
    expect(stats.mode & 0o777).toBe(0o755);
  });

  it('upgrades schema v1 verse data to schema v2 without losing runs', async () => {
    const repository = new VerseRepository(tempDir);
    const branch = 'main';
    const versePath = getVersePath(tempDir, branch);
    const v1Content = {
      schemaVersion: 1,
      id: 'verse-1',
      branch,
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
      runs: [
        {
          runId: 'run-1',
          startAt: '2026-04-02T00:00:00.000Z',
        },
      ],
    };

    await fs.mkdir(path.dirname(versePath), { recursive: true });
    await fs.writeFile(versePath, `${JSON.stringify(v1Content, null, 2)}\n`);

    const verse = await repository.writeVerse({
      branch,
      mutate: () => undefined,
    });
    const persisted = await repository.readVerse(versePath);

    expect(verse.schemaVersion).toBe(2);
    expect(verse.id).toBe(v1Content.id);
    expect(verse.projectRoot).toBe(tempDir);
    expect(verse.runs).toEqual(v1Content.runs);
    expect(verse.environment.hostPath).toBe(getVerseEnvironmentHostPath(tempDir, v1Content.id));
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.runs).toEqual(v1Content.runs);
    expect(persisted.environment.hostPath).toBe(getVerseEnvironmentHostPath(tempDir, v1Content.id));
  });

  it('normalizes a persisted schema v2 verse back to the active project root', async () => {
    const repository = new VerseRepository(tempDir);
    const branch = 'main';
    const versePath = getVersePath(tempDir, branch);
    const staleVerse = {
      schemaVersion: 2,
      id: 'verse-2',
      branch,
      projectRoot: '/stale/project',
      environment: {
        hostPath: '/stale/project/.multiverse/verse-envs/verse-2/home',
        containerPath: CLAUDE_HOME_CONTAINER_PATH,
        initializedAt: '2026-04-02T00:00:00.000Z',
      },
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
      runs: [],
    };

    await fs.mkdir(path.dirname(versePath), { recursive: true });
    await fs.writeFile(versePath, `${JSON.stringify(staleVerse, null, 2)}\n`);

    const verse = await repository.readVerse(versePath);

    expect(verse.schemaVersion).toBe(2);
    expect(verse.projectRoot).toBe(tempDir);
    expect(verse.environment.hostPath).toBe(getVerseEnvironmentHostPath(tempDir, staleVerse.id));
    expect(verse.environment.containerPath).toBe(CLAUDE_HOME_CONTAINER_PATH);
    expect(verse.environment.initializedAt).toBe(staleVerse.environment.initializedAt);
  });

  it('normalizes a persisted schema v2 verse branch to the requested branch on write', async () => {
    const repository = new VerseRepository(tempDir);
    const requestedBranch = 'feature/requested-branch';
    const versePath = getVersePath(tempDir, requestedBranch);
    const staleVerse = {
      schemaVersion: 2,
      id: 'verse-branch-1',
      branch: 'feature/stale-branch',
      projectRoot: tempDir,
      environment: {
        hostPath: getVerseEnvironmentHostPath(tempDir, 'verse-branch-1'),
        containerPath: CLAUDE_HOME_CONTAINER_PATH,
        initializedAt: '2026-04-02T00:00:00.000Z',
      },
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
      runs: [],
    };

    await fs.mkdir(path.dirname(versePath), { recursive: true });
    await fs.writeFile(versePath, `${JSON.stringify(staleVerse, null, 2)}\n`);

    const verse = await repository.writeVerse({
      branch: requestedBranch,
      mutate: () => undefined,
    });
    const persisted = await repository.readVerse(versePath);

    expect(verse.branch).toBe(requestedBranch);
    expect(persisted.branch).toBe(requestedBranch);
    expect(persisted.projectRoot).toBe(tempDir);
    expect(persisted.environment.hostPath).toBe(
      getVerseEnvironmentHostPath(tempDir, staleVerse.id),
    );
  });

  it('rejects malformed structured verse content', async () => {
    const repository = new VerseRepository(tempDir);
    const versePath = getVersePath(tempDir, 'main');

    await fs.mkdir(path.dirname(versePath), { recursive: true });
    await fs.writeFile(
      versePath,
      `${JSON.stringify(
        {
          schemaVersion: 2,
          id: 'verse-3',
          branch: 'main',
          projectRoot: tempDir,
          environment: {
            hostPath: getVerseEnvironmentHostPath(tempDir, 'verse-3'),
            containerPath: CLAUDE_HOME_CONTAINER_PATH,
            initializedAt: '2026-04-02T00:00:00.000Z',
          },
          createdAt: '2026-04-02T00:00:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
          runs: [
            {
              runId: 'run-1',
              startAt: 123,
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    await expect(repository.readVerse(versePath)).rejects.toMatchObject({
      name: 'VerseCorruptedError',
    });
  });

  it('throws VerseLockTimeoutError when the lock cannot be acquired in 3 seconds', async () => {
    const repository = new VerseRepository(tempDir);
    const branch = 'feature/lock-competition';
    const versePath = getVersePath(tempDir, branch);
    const lockPath = `${versePath}.lock`;
    const verseDir = path.dirname(versePath);

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
