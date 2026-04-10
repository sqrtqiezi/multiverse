import assert from 'node:assert';
import { exec, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import { sharedState } from './shared-state.js';

const execAsync = promisify(exec);
const startCommandTimeoutMs = Number(process.env.MULTIVERSE_E2E_START_TIMEOUT_MS ?? '60000');

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

function getVersesDir(repoRoot: string) {
  return path.join(repoRoot, '.multiverse', 'verses');
}

function getVerseEnvironmentStateRoot(repoRoot: string) {
  return path.join(repoRoot, '.multiverse', 'verse-envs');
}

function getVersePath(repoRoot: string, branch: string) {
  const branchHash = createHash('sha1').update(branch).digest('hex').slice(0, 8);
  const sanitizedBranch = branch
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  return path.join(repoRoot, '.multiverse', 'verses', `${sanitizedBranch}__${branchHash}.json`);
}

function getVersePathCandidates(repoRoot: string, branch: string) {
  return [getVersePath(repoRoot, branch)];
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

let repoRootCache: string | undefined;
let cliBuildDone = false;
let currentHomeDir: string | undefined;
let currentTemplateName: string | undefined;
let baselineTemplateCount = 0;

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

async function getCurrentBranch() {
  const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
  const branch = stdout.trim();

  if (branch === 'HEAD') {
    const commit = (await execAsync('git rev-parse --short HEAD')).stdout.trim();
    return `detached-${commit}`;
  }

  return branch;
}

async function readTemplateByName(repoRoot: string, templateName: string) {
  const templatesDir = getTemplatesDir(repoRoot);
  const entries = await fs.readdir(templatesDir);

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const raw = await fs.readFile(path.join(templatesDir, entry), 'utf8');
    const template = JSON.parse(raw) as { id: string; name: string };
    if (template.name === templateName) {
      return template;
    }
  }

  throw new Error(`Expected template "${templateName}" to exist in ${templatesDir}`);
}

async function listTemplates(repoRoot: string) {
  const templatesDir = getTemplatesDir(repoRoot);

  try {
    const entries = await fs.readdir(templatesDir);
    const templates: Array<{ id: string; name: string }> = [];

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(templatesDir, entry), 'utf8');
      templates.push(JSON.parse(raw) as { id: string; name: string });
    }

    return templates;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function resolveCurrentVersePath() {
  const [repoRoot, branch] = await Promise.all([getCachedRepoRoot(), getCurrentBranch()]);
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
    verse: JSON.parse(raw) as { templateId: string },
  };
}

async function prepareCurrentConfig(templateName: string) {
  const repoRoot = await getCachedRepoRoot();
  const home = getTemplateHome(repoRoot);

  currentHomeDir = home;
  currentTemplateName = templateName;

  await fs.rm(home, { force: true, recursive: true });
  await fs.mkdir(path.join(home, '.claude'), { recursive: true });
  await fs.writeFile(path.join(home, 'CLAUDE.md'), '# Story 2.2 baseline\n', 'utf8');
  await fs.writeFile(
    path.join(home, '.claude', 'settings.json'),
    JSON.stringify({ editor: 'vim', theme: 'light' }, null, 2),
    'utf8',
  );

  await ensureCliBuilt(repoRoot);
  const env = { ...process.env, HOME: home } as NodeJS.ProcessEnv;
  await execAsync(`node packages/cli/dist/cli.js template create ${templateName}`, {
    cwd: repoRoot,
    env,
  });

  baselineTemplateCount = (await listTemplates(repoRoot)).length;
}

async function runStart(command: string, answers: string[] = []) {
  const repoRoot = await getCachedRepoRoot();
  await ensureCliBuilt(repoRoot);

  const commandToRun = command.startsWith('multiverse ')
    ? `node packages/cli/dist/cli.js ${command.slice('multiverse '.length)}`
    : command;
  const commandWithTemplate =
    commandToRun === 'node packages/cli/dist/cli.js start' && currentTemplateName
      ? `${commandToRun} --template ${currentTemplateName}`
      : commandToRun;
  assert(currentHomeDir, 'Expected a prepared home directory before running the command');
  const env = {
    ...process.env,
    HOME: currentHomeDir,
    ANTHROPIC_API_KEY: 'sk-ant-e2e-dummy-key',
    MULTIVERSE_CLAUDE_PRINT_PROMPT: "printf '%s\\n' 'E2E_TEMPLATE_DRIFT_OK'",
  } as NodeJS.ProcessEnv;

  const [bin, ...args] = commandWithTemplate.split(' ');
  await new Promise<void>((resolve) => {
    const child = spawn(bin, args, {
      cwd: repoRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    for (const answer of answers) {
      child.stdin.write(`${answer}\n`);
    }
    child.stdin.end();

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
    }, startCommandTimeoutMs);

    child.on('close', (code) => {
      clearTimeout(timeout);
      sharedState.commandOutput = stdout + stderr;
      sharedState.commandExitCode = code ?? 1;
      resolve();
    });
  });
}

Before({ tags: '@template-drift' }, async () => {
  repoRootCache = undefined;
  currentHomeDir = undefined;
  currentTemplateName = undefined;
  baselineTemplateCount = 0;
  const repoRoot = await getCachedRepoRoot();
  const templatesDir = getTemplatesDir(repoRoot);
  await fs.rm(templatesDir, { force: true, recursive: true });
  await fs.rm(getVersesDir(repoRoot), { force: true, recursive: true });
  await fs.rm(getVerseEnvironmentStateRoot(repoRoot), { force: true, recursive: true });
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

Given('the current global config still matches template {string}', async (templateName: string) => {
  await prepareCurrentConfig(templateName);
});

Given(
  'the current global config drifts from template {string} by changing {string}',
  async (templateName: string, fileName: string) => {
    await prepareCurrentConfig(templateName);

    assert(currentHomeDir, 'Expected a prepared home directory before mutating config');
    if (fileName === 'CLAUDE.md') {
      await fs.writeFile(
        path.join(currentHomeDir, 'CLAUDE.md'),
        '# Story 2.2 drifted configuration\n',
      );
      return;
    }

    if (fileName === '.claude/settings.json') {
      await fs.writeFile(
        path.join(currentHomeDir, '.claude', 'settings.json'),
        JSON.stringify({ editor: 'vim', theme: 'dark' }, null, 2),
        'utf8',
      );
      return;
    }

    throw new Error(`Unsupported drift target: ${fileName}`);
  },
);

When('I run {string} in scripted mode', async (command: string) => {
  await runStart(command);
});

When(
  'I run {string} in scripted mode with answers:',
  async (command: string, docString: string) => {
    const answers = docString
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    await runStart(command, answers);
  },
);

Then('the output should not contain {string}', (unexpectedText: string) => {
  assert(
    !sharedState.commandOutput.includes(unexpectedText),
    `Expected output not to contain "${unexpectedText}", but got: ${sharedState.commandOutput}`,
  );
});

Then(
  'the current branch verse should still reference template {string}',
  async (templateName: string) => {
    const repoRoot = await getCachedRepoRoot();
    const template = await readTemplateByName(repoRoot, templateName);
    const { verse, versePath } = await readCurrentVerse();

    assert.strictEqual(
      verse.templateId,
      template.id,
      `Expected verse at ${versePath} to reference template "${templateName}" (${template.id}), but found ${verse.templateId}`,
    );
  },
);

Then('the templates directory should contain one more template', async () => {
  const repoRoot = await getCachedRepoRoot();
  const templates = await listTemplates(repoRoot);

  assert.strictEqual(
    templates.length,
    baselineTemplateCount + 1,
    `Expected templates count to increase by one from ${baselineTemplateCount}, but found ${templates.length}`,
  );
});

Then(
  'the current branch verse should reference a template different from {string}',
  async (templateName: string) => {
    const repoRoot = await getCachedRepoRoot();
    const template = await readTemplateByName(repoRoot, templateName);
    const { verse, versePath } = await readCurrentVerse();

    assert.notStrictEqual(
      verse.templateId,
      template.id,
      `Expected verse at ${versePath} to reference a template different from "${templateName}" (${template.id}), but found ${verse.templateId}`,
    );
  },
);
