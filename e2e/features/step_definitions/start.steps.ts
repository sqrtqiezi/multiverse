import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Given, Then, When } from '@cucumber/cucumber';

const execAsync = promisify(exec);
const runDockerScenarios = process.env.MULTIVERSE_E2E_DOCKER === '1';
const verseDir = '.multiverse/verses';

let commandOutput = '';
let commandExitCode = 0;
let lastObservedRunCount: number | undefined;

async function getRepoRoot() {
  const { stdout } = await execAsync('git rev-parse --show-toplevel');
  return stdout.trim();
}

async function getCurrentBranch() {
  const { stdout } = await execAsync('git branch --show-current');
  const branch = stdout.trim();

  if (!branch) {
    return 'detached-head';
  }

  return branch;
}

function sanitizeBranchName(branch: string) {
  return branch.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getVersePathCandidates(repoRoot: string, branch: string) {
  const sanitizedBranch = sanitizeBranchName(branch);
  const branchHash = createHash('sha1').update(branch).digest('hex').slice(0, 8);

  return [
    path.join(repoRoot, verseDir, `${sanitizedBranch}.json`),
    path.join(repoRoot, verseDir, `${sanitizedBranch.toLowerCase()}-${branchHash}.json`),
  ];
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveCurrentVersePath() {
  const [repoRoot, branch] = await Promise.all([getRepoRoot(), getCurrentBranch()]);
  const candidates = getVersePathCandidates(repoRoot, branch);

  for (const versePath of candidates) {
    if (await pathExists(versePath)) {
      return { branch, candidates, repoRoot, versePath };
    }
  }

  return {
    branch,
    candidates,
    repoRoot,
    versePath: candidates[0],
  };
}

async function readCurrentVerse() {
  const { branch, candidates, repoRoot, versePath } = await resolveCurrentVersePath();
  const raw = await fs.readFile(versePath, 'utf8');

  return {
    branch,
    candidates,
    repoRoot,
    versePath,
    verse: JSON.parse(raw),
  };
}

async function assertVerseFileAbsent() {
  const { candidates } = await resolveCurrentVersePath();
  const existingPaths = [];

  for (const candidatePath of candidates) {
    if (await pathExists(candidatePath)) {
      existingPaths.push(candidatePath);
    }
  }

  assert.strictEqual(
    existingPaths.length,
    0,
    `Expected verse file to be absent, but found: ${existingPaths.join(', ')}`,
  );
}

async function findExistingVersePath() {
  const { candidates } = await resolveCurrentVersePath();

  for (const candidatePath of candidates) {
    if (await pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  return undefined;
}

Given('Docker is not running', async function () {
  if (!runDockerScenarios) {
    return 'skipped';
  }
});

Given('Docker is available', async function () {
  if (!runDockerScenarios) {
    return 'skipped';
  }

  try {
    await execAsync('docker ps');
  } catch {
    return 'skipped';
  }
});

Given('Claude credentials do not exist', async function () {
  if (!runDockerScenarios) {
    return 'skipped';
  }
});

Given('Claude credentials exist', async function () {
  if (!runDockerScenarios) {
    return 'skipped';
  }
});

Given('verse file for current branch should not exist', async () => {
  await assertVerseFileAbsent();
  lastObservedRunCount = undefined;
});

When('I run {string}', async (command: string) => {
  try {
    const result = await execAsync(command, { timeout: 5000 });
    commandOutput = result.stdout + result.stderr;
    commandExitCode = 0;
  } catch (error: any) {
    commandOutput = error.stdout + error.stderr;
    commandExitCode = error.code || 1;
  }
});

Then('the output should contain {string}', (expectedText: string) => {
  assert(
    commandOutput.includes(expectedText),
    `Expected output to contain "${expectedText}", but got: ${commandOutput}`,
  );
});

Then('the exit code should be {int}', (expectedCode: number) => {
  assert.strictEqual(commandExitCode, expectedCode);
});

Then('a container should be created', async () => {
  const { stdout } = await execAsync(
    'docker ps -a --filter "ancestor=multiverse/claude-code:latest" --format "{{.ID}}"',
  );
  assert(stdout.trim().length > 0, 'No container found');
});

Then('the container should be running', async () => {
  const { stdout } = await execAsync(
    'docker ps --filter "ancestor=multiverse/claude-code:latest" --format "{{.ID}}"',
  );
  assert(stdout.trim().length > 0, 'Container is not running');
});

Then('I should see {string}', (expectedText: string) => {
  assert(commandOutput.includes(expectedText));
});


Then('verse file for current branch should exist', async () => {
  const existingPath = await findExistingVersePath();

  assert(existingPath, 'Expected a verse file to exist');

  const stats = await fs.stat(existingPath);
  assert(stats.isFile(), `Expected verse file to exist at ${existingPath}`);
});

Then('verse file for current branch has at least 1 run', async () => {
  const { verse, versePath } = await readCurrentVerse();

  assert(Array.isArray(verse.runs), `Expected runs array in ${versePath}`);
  assert(verse.runs.length >= 1, `Expected at least 1 run in ${versePath}`);

  lastObservedRunCount = verse.runs.length;
});

Then('verse file for current branch should have one more run', async () => {
  const { verse, versePath } = await readCurrentVerse();

  assert(
    typeof lastObservedRunCount === 'number',
    'Expected a previous run count before checking for one more run',
  );
  assert(Array.isArray(verse.runs), `Expected runs array in ${versePath}`);
  assert.strictEqual(
    verse.runs.length,
    lastObservedRunCount + 1,
    `Expected one more run in ${versePath}, but found ${verse.runs.length} after baseline ${lastObservedRunCount}`,
  );

  lastObservedRunCount = verse.runs.length;
});

Then('latest run in current branch verse should contain finish fields', async () => {
  const { verse, versePath } = await readCurrentVerse();
  const latestRun = verse.runs?.at(-1);

  assert(latestRun, `Expected at least one run in ${versePath}`);
  assert.ok(latestRun.endAt, `Expected latest run in ${versePath} to include endAt`);
  assert.strictEqual(
    typeof latestRun.exitCode,
    'number',
    `Expected latest run in ${versePath} to include exitCode`,
  );
  assert.ok(
    latestRun.containerId,
    `Expected latest run in ${versePath} to include containerId`,
  );
});
