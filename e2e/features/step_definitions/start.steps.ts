import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
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

async function readCurrentVerse() {
  const [repoRoot, branch] = await Promise.all([getRepoRoot(), getCurrentBranch()]);
  const versePath = path.join(repoRoot, verseDir, `${sanitizeBranchName(branch)}.json`);
  const raw = await fs.readFile(versePath, 'utf8');

  return {
    branch,
    versePath,
    verse: JSON.parse(raw),
  };
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
  const { versePath } = await readCurrentVerse();
  const stats = await fs.stat(versePath);

  assert(stats.isFile(), `Expected verse file to exist at ${versePath}`);
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
