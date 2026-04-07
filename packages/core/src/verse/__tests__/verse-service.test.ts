import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLAUDE_HOME_CONTAINER_PATH } from '../claude-home.js';
import { VerseService } from '../verse-service.js';

const execFileAsync = promisify(execFile);

describe('VerseService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multiverse-verse-service-'));
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: tempDir });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
    await fs.writeFile(path.join(tempDir, 'README.md'), '# test\n');
    await execFileAsync('git', ['add', '.'], { cwd: tempDir });
    await execFileAsync('git', ['commit', '-m', 'init'], { cwd: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns schema v2 environment metadata when ensuring a verse for the current branch', async () => {
    const service = new VerseService();

    const verse = await service.ensureVerseForCurrentBranch(tempDir);
    const expectedHostPath = path.join(
      tempDir,
      '.multiverse',
      'verse-envs',
      verse.id,
      'home',
    );
    const versesDir = path.join(tempDir, '.multiverse', 'verses');
    const files = await fs.readdir(versesDir);

    expect(verse.schemaVersion).toBe(2);
    expect(verse.projectRoot).toBe(tempDir);
    expect(verse.environment.hostPath).toBe(expectedHostPath);
    expect(verse.environment.containerPath).toBe(CLAUDE_HOME_CONTAINER_PATH);
    expect(verse.environment.initializedAt).toBeTypeOf('string');
    expect(verse.runs).toEqual([]);
    expect(verse.createdAt).toBeTypeOf('string');
    expect(verse.updatedAt).toBeTypeOf('string');
    expect(files.length).toBeGreaterThan(0);
    expect((await fs.stat(verse.environment.hostPath)).isDirectory()).toBe(true);
  });

  it('reuses the same verse environment path on repeated ensure calls', async () => {
    const service = new VerseService();

    const first = await service.ensureVerseForCurrentBranch(tempDir);
    const second = await service.ensureVerseForCurrentBranch(tempDir);

    expect(second.id).toBe(first.id);
    expect(second.branch).toBe(first.branch);
    expect(second.environment.hostPath).toBe(first.environment.hostPath);
    expect(second.environment.initializedAt).toBe(first.environment.initializedAt);
  });

  it('keeps detached HEAD handling compatible with verse ensure', async () => {
    await execFileAsync('git', ['checkout', '--detach'], { cwd: tempDir });

    const service = new VerseService();
    const verse = await service.ensureVerseForCurrentBranch(tempDir);

    expect(verse.schemaVersion).toBe(2);
    expect(verse.branch).toMatch(/^detached-/);
    expect(verse.environment.hostPath).toContain(
      path.join('.multiverse', 'verse-envs'),
    );
  });

  it('appends a run start and then finalizes it by runId on schema v2 verses', async () => {
    const service = new VerseService();

    const ensured = await service.ensureVerseForCurrentBranch(tempDir);

    expect(ensured.schemaVersion).toBe(2);

    await service.appendRunStart({
      cwd: tempDir,
      runId: 'run-1',
      startAt: '2026-04-02T00:00:00.000Z',
    });
    const started = await service.appendRunStart({
      cwd: tempDir,
      runId: 'run-2',
      startAt: '2026-04-02T00:00:30.000Z',
    });

    expect(started.runs).toHaveLength(2);
    expect(started.schemaVersion).toBe(2);
    expect(started.runs[0]).toMatchObject({
      runId: 'run-1',
      startAt: '2026-04-02T00:00:00.000Z',
    });
    expect(started.runs[1]).toMatchObject({
      runId: 'run-2',
      startAt: '2026-04-02T00:00:30.000Z',
    });

    const finalized = await service.finalizeRun({
      cwd: tempDir,
      runId: 'run-1',
      endAt: '2026-04-02T00:01:00.000Z',
      exitCode: 0,
      containerId: 'container-1',
    });

    expect(finalized.runs).toHaveLength(2);
    expect(finalized.schemaVersion).toBe(2);
    expect(finalized.runs.find((run) => run.runId === 'run-1')).toMatchObject({
      runId: 'run-1',
      startAt: '2026-04-02T00:00:00.000Z',
      endAt: '2026-04-02T00:01:00.000Z',
      exitCode: 0,
      containerId: 'container-1',
    });
    expect(finalized.runs.find((run) => run.runId === 'run-2')).toMatchObject({
      runId: 'run-2',
      startAt: '2026-04-02T00:00:30.000Z',
    });
  });

  it('throws RunNotFoundError when finalizing an unknown runId', async () => {
    const service = new VerseService();

    await expect(
      service.finalizeRun({
        cwd: tempDir,
        runId: 'missing-run',
        endAt: '2026-04-02T00:01:00.000Z',
        exitCode: 1,
        containerId: 'container-1',
      }),
    ).rejects.toMatchObject({ name: 'RunNotFoundError' });
  });
});
