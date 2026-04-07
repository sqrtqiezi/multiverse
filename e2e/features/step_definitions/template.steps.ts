import assert from 'node:assert';
import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Before, Given, Then } from '@cucumber/cucumber';
import { sharedState } from './shared-state.js';

const execAsync = promisify(exec);

async function getRepoRoot() {
  const { stdout } = await execAsync('git rev-parse --show-toplevel');
  return stdout.trim();
}

function getTemplateHome(repoRoot: string) {
  return path.join(repoRoot, '.e2e-tmp-home-with-creds');
}

function getTemplatesDir(repoRoot: string) {
  return path.join(getTemplateHome(repoRoot), '.multiverse', 'templates');
}

let repoRootCache: string | undefined;
let cliBuildDone = false;

async function getCachedRepoRoot() {
  if (!repoRootCache) {
    repoRootCache = await getRepoRoot();
  }
  return repoRootCache;
}

async function ensureCliBuilt(repoRoot: string) {
  if (cliBuildDone) return;
  await execAsync('pnpm --filter @multiverse/types build', { cwd: repoRoot });
  await execAsync('pnpm --filter @multiverse/core build', { cwd: repoRoot });
  await execAsync('pnpm --filter @multiverse/cli build', { cwd: repoRoot });
  cliBuildDone = true;
}

Before(async () => {
  repoRootCache = undefined;
  // Clean up templates directory to avoid cross-scenario pollution
  const repoRoot = await getCachedRepoRoot();
  const templatesDir = getTemplatesDir(repoRoot);
  await fs.rm(templatesDir, { force: true, recursive: true });
});

Given('a valid Claude home directory exists', async () => {
  const repoRoot = await getCachedRepoRoot();
  const home = getTemplateHome(repoRoot);
  const claudeDir = path.join(home, '.claude');
  const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');

  await fs.mkdir(claudeDir, { recursive: true });

  try {
    await fs.access(claudeMdPath);
  } catch {
    await fs.writeFile(claudeMdPath, '# Claude configuration\n', 'utf8');
  }
});

Given('I have created a template named {string}', async (name: string) => {
  const repoRoot = await getCachedRepoRoot();
  const home = getTemplateHome(repoRoot);

  await ensureCliBuilt(repoRoot);

  const env = { ...process.env, HOME: home } as NodeJS.ProcessEnv;

  const result = await execAsync(`node packages/cli/dist/cli.js template create ${name}`, {
    cwd: repoRoot,
    env,
  }).catch((err: unknown) => {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    throw new Error(
      `Failed to create template "${name}" (exit code ${e.code}): ${(e.stdout ?? '') + (e.stderr ?? '')}`,
    );
  });

  const output = result.stdout + result.stderr;
  assert(
    output.includes(name),
    `Expected template creation output to contain "${name}", got: ${output}`,
  );
});

Then('a template file should exist in the templates directory', async () => {
  const repoRoot = await getCachedRepoRoot();
  const templatesDir = getTemplatesDir(repoRoot);

  const files = await fs.readdir(templatesDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  assert(
    jsonFiles.length > 0,
    `Expected at least one .json file in ${templatesDir}, but found none. Files: ${files.join(', ')}`,
  );
});

Then('the output should be valid JSON', () => {
  const output = sharedState.commandOutput;
  try {
    JSON.parse(output);
  } catch {
    assert.fail(`Expected output to be valid JSON, but got: ${output}`);
  }
});

Then('the JSON output should contain a template named {string}', (name: string) => {
  const output = sharedState.commandOutput;
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    assert.fail(`Expected valid JSON output, but got: ${output}`);
  }

  assert(Array.isArray(parsed), `Expected JSON array, got: ${JSON.stringify(parsed)}`);
  const found = (parsed as Array<{ name: string }>).find((t) => t.name === name);
  assert(
    found,
    `Expected JSON output to contain a template named "${name}", but got: ${JSON.stringify(parsed)}`,
  );
});
