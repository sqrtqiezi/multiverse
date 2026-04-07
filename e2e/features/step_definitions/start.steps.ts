import assert from 'node:assert';
import { exec } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { After, Before, Given, setDefaultTimeout, Then, When } from '@cucumber/cucumber';

const execAsync = promisify(exec);
const startCommandTimeoutMs = Number(process.env.MULTIVERSE_E2E_START_TIMEOUT_MS ?? '60000');
const verseDir = '.multiverse/verses';
setDefaultTimeout(startCommandTimeoutMs);

type ScenarioDockerMode = 'normal' | 'unavailable';
type ScenarioCredentialMode = 'exists' | 'missing';
type ScenarioBackendMode = 'default' | 'ollama';

let commandOutput = '';
let commandExitCode = 0;
let lastObservedRunCount: number | undefined;
let rememberedEnvironmentPath: string | undefined;
let rememberedEnvironmentMarker:
  | {
      content: string;
      inode: number;
      path: string;
    }
  | undefined;
let recordedContainerIds: string[] = [];
let markerWritingPromptMode = false;
let dockerMode: ScenarioDockerMode = 'normal';
let credentialMode: ScenarioCredentialMode = 'exists';
let backendMode: ScenarioBackendMode = 'default';
let cliBuilt = false;
let ollamaRuntimeReady = false;

const ollamaExpectedToken =
  process.env.MULTIVERSE_E2E_OLLAMA_EXPECTED_TOKEN ?? 'E2E_OLLAMA_OK_20260403';
const ollamaPrompt = `printf '%s\\n' '${ollamaExpectedToken}'`;
const ollamaScriptedPrompt = `printf '%s\\n' '${ollamaExpectedToken}'; printf '%s\\n' '${ollamaExpectedToken}' > ~/.claude/e2e-marker.txt`;

function getOllamaModel() {
  return process.env.MULTIVERSE_E2E_OLLAMA_MODEL ?? 'qwen3-coder:480b-cloud';
}

function getOllamaHostBaseUrl() {
  return process.env.MULTIVERSE_E2E_OLLAMA_HOST_BASE_URL ?? 'http://127.0.0.1:11434';
}

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function invokeAnthropicCompatibleApi(baseUrl: string, prompt: string) {
  const response = await fetch(`${stripTrailingSlash(baseUrl)}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.MULTIVERSE_E2E_OLLAMA_API_KEY ?? 'sk-ant-e2e-local',
    },
    body: JSON.stringify({
      model: getOllamaModel(),
      max_tokens: 32,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Anthropic-compatible API request failed: status=${response.status}, body=${text}`,
    );
  }

  return text;
}

async function getRepoRoot() {
  const { stdout } = await execAsync('git rev-parse --show-toplevel');
  return stdout.trim();
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

function sanitizeBranchName(branch: string) {
  return branch
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
}

function getVersePathCandidates(repoRoot: string, branch: string) {
  const sanitizedBranch = sanitizeBranchName(branch);
  const branchHash = createHash('sha1').update(branch).digest('hex').slice(0, 8);

  return [path.join(repoRoot, verseDir, `${sanitizedBranch}__${branchHash}.json`)];
}

function getVerseEnvironmentStateRoot(repoRoot: string) {
  return path.join(repoRoot, '.multiverse', 'verse-envs');
}

function getVerseEnvironmentMarkerPath(hostPath: string) {
  return path.join(hostPath, '.claude', 'e2e-marker.txt');
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

async function ensureCliBuilt(repoRoot: string) {
  if (cliBuilt) {
    return;
  }

  await execAsync('pnpm --filter @multiverse/types build', { cwd: repoRoot });
  await execAsync('pnpm --filter @multiverse/core build', { cwd: repoRoot });
  await execAsync('pnpm --filter @multiverse/cli build', { cwd: repoRoot });
  cliBuilt = true;
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

async function recordLatestRunContainerId() {
  const versePath = await findExistingVersePath();

  if (!versePath) {
    return;
  }

  const { verse } = await readCurrentVerse();
  const latestRun = verse.runs?.at(-1);

  if (!latestRun?.containerId) {
    return;
  }

  if (!recordedContainerIds.includes(latestRun.containerId)) {
    recordedContainerIds.push(latestRun.containerId);
  }
}

async function cleanupRecordedMultiverseContainers() {
  if (recordedContainerIds.length === 0) {
    return [];
  }

  const containerIds = [...recordedContainerIds];

  await execAsync(
    `docker rm -f ${containerIds.map((id) => `'${id}'`).join(' ')} >/dev/null 2>&1 || true`,
  );

  recordedContainerIds = [];
  return containerIds;
}

async function resetVerseEnvironmentState(repoRoot: string) {
  await fs.rm(getVerseEnvironmentStateRoot(repoRoot), { force: true, recursive: true });
}

async function readVerseEnvironmentMarker() {
  const { verse, versePath } = await readCurrentVerse();
  assert.ok(
    verse.environment?.hostPath,
    `Expected environment.hostPath in ${versePath} before reading the marker`,
  );
  const markerPath = getVerseEnvironmentMarkerPath(verse.environment.hostPath);
  const content = await fs.readFile(markerPath, 'utf8');
  const stats = await fs.stat(markerPath);

  return {
    content: content.trim(),
    inode: stats.ino,
    markerPath,
    verse,
    versePath,
  };
}

function resetScenarioState() {
  lastObservedRunCount = undefined;
  rememberedEnvironmentPath = undefined;
  rememberedEnvironmentMarker = undefined;
  recordedContainerIds = [];
}

Before(() => {
  dockerMode = 'normal';
  credentialMode = 'exists';
  backendMode = 'default';
  ollamaRuntimeReady = false;
  markerWritingPromptMode = false;
  resetScenarioState();
});

Given('Docker is not running', async () => {
  dockerMode = 'unavailable';
});

Given('Docker is available', async () => {
  dockerMode = 'normal';

  try {
    await execAsync('docker ps');
  } catch (error) {
    throw new Error(`Docker is required for this scenario: ${String(error)}`);
  }
});

Given('Claude credentials do not exist', async () => {
  credentialMode = 'missing';
});

Given('Claude credentials exist', async () => {
  credentialMode = 'exists';
});

Given('Ollama Anthropic-compatible API is available', async () => {
  backendMode = 'ollama';
  await invokeAnthropicCompatibleApi(getOllamaHostBaseUrl(), ollamaPrompt);
  ollamaRuntimeReady = true;
});

Given('marker-writing prompt mode is enabled', async () => {
  markerWritingPromptMode = true;
});

Given('verse file for current branch should not exist', async () => {
  const repoRoot = await getRepoRoot();
  const { candidates } = await resolveCurrentVersePath();
  for (const candidatePath of candidates) {
    await fs.rm(candidatePath, { force: true });
  }
  await resetVerseEnvironmentState(repoRoot);
  await assertVerseFileAbsent();
  resetScenarioState();
});

When('I run {string}', async (command: string) => {
  const repoRoot = await getRepoRoot();
  await ensureCliBuilt(repoRoot);
  const commandToRun =
    command === 'multiverse start' ? 'node packages/cli/dist/cli.js start' : command;
  const env = { ...process.env } as Record<string, string | undefined>;

  if (dockerMode === 'unavailable') {
    env.DOCKER_HOST = 'unix:///var/run/nonexistent-docker.sock';
  } else {
    delete env.DOCKER_HOST;
  }

  if (credentialMode === 'missing') {
    for (const key of Object.keys(env)) {
      if (key.startsWith('ANTHROPIC_') || key.startsWith('CLAUDE_CODE_')) {
        delete env[key];
      }
    }
    env.HOME = path.join(repoRoot, '.e2e-tmp-home-no-creds');
    await fs.mkdir(env.HOME, { recursive: true });
  } else {
    for (const key of Object.keys(env)) {
      if (key.startsWith('ANTHROPIC_') || key.startsWith('CLAUDE_CODE_')) {
        delete env[key];
      }
    }
    env.HOME = path.join(repoRoot, '.e2e-tmp-home-with-creds');
    await fs.mkdir(env.HOME, { recursive: true });
    // Create .claude directory for preflight checks
    const claudeDir = path.join(env.HOME, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    if (backendMode === 'ollama') {
      if (!ollamaRuntimeReady) {
        await invokeAnthropicCompatibleApi(getOllamaHostBaseUrl(), ollamaPrompt);
        ollamaRuntimeReady = true;
      }
      env.ANTHROPIC_API_KEY = process.env.MULTIVERSE_E2E_OLLAMA_API_KEY ?? 'sk-ant-e2e-local';
      env.ANTHROPIC_BASE_URL = getOllamaHostBaseUrl();
      env.ANTHROPIC_MODEL = getOllamaModel();
      env.MULTIVERSE_CLAUDE_PRINT_PROMPT = markerWritingPromptMode
        ? ollamaScriptedPrompt
        : ollamaPrompt;
    } else {
      env.ANTHROPIC_API_KEY = 'sk-ant-e2e-dummy-key';
      delete env.ANTHROPIC_BASE_URL;
      delete env.ANTHROPIC_MODEL;
      delete env.MULTIVERSE_CLAUDE_PRINT_PROMPT;
    }
  }

  try {
    const result = await execAsync(commandToRun, {
      cwd: repoRoot,
      env: env as NodeJS.ProcessEnv,
      timeout: startCommandTimeoutMs,
    });
    commandOutput = result.stdout + result.stderr;
    commandExitCode = 0;
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    commandOutput = (execError.stdout ?? '') + (execError.stderr ?? '');
    commandExitCode = execError.code ?? 1;
  }

  if (commandToRun === 'node packages/cli/dist/cli.js start') {
    await recordLatestRunContainerId();
  }
});

After(async () => {
  await cleanupRecordedMultiverseContainers();
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

Then('current branch verse should include environment metadata', async () => {
  const { verse, versePath } = await readCurrentVerse();

  assert.strictEqual(verse.schemaVersion, 2, `Expected schemaVersion 2 in ${versePath}`);
  assert.ok(verse.projectRoot, `Expected projectRoot in ${versePath}`);
  assert.ok(verse.environment, `Expected environment block in ${versePath}`);
  assert.ok(verse.environment.hostPath, `Expected environment.hostPath in ${versePath}`);
  assert.ok(verse.environment.containerPath, `Expected environment.containerPath in ${versePath}`);
  assert.ok(verse.environment.initializedAt, `Expected environment.initializedAt in ${versePath}`);
});

Then('current branch verse environment directory should exist', async () => {
  const { verse } = await readCurrentVerse();
  const stats = await fs.stat(verse.environment.hostPath);

  assert(stats.isDirectory(), `Expected ${verse.environment.hostPath} to be a directory`);
});

Then('current branch verse environment directory should contain the expected marker', async () => {
  const { markerPath, content } = await readVerseEnvironmentMarker();

  assert.strictEqual(
    content,
    ollamaExpectedToken,
    `Expected ${markerPath} to contain ${ollamaExpectedToken}, but got ${content}`,
  );
});

Then('remember the current branch verse environment path', async () => {
  const { verse, versePath } = await readCurrentVerse();

  assert.ok(
    verse.environment?.hostPath,
    `Expected environment.hostPath in ${versePath} before remembering it`,
  );
  rememberedEnvironmentPath = verse.environment.hostPath;
  lastObservedRunCount = Array.isArray(verse.runs) ? verse.runs.length : undefined;
});

Then('remember the current branch verse environment marker', async () => {
  const { content, inode, markerPath } = await readVerseEnvironmentMarker();

  rememberedEnvironmentMarker = {
    content,
    inode,
    path: markerPath,
  };
});

Then('current branch verse should reuse the remembered environment path', async () => {
  const { verse, versePath } = await readCurrentVerse();

  assert.ok(
    rememberedEnvironmentPath,
    'Expected a remembered environment path before checking reuse',
  );
  assert.strictEqual(
    verse.environment.hostPath,
    rememberedEnvironmentPath,
    `Expected current branch verse to reuse ${rememberedEnvironmentPath}, but found ${verse.environment.hostPath} in ${versePath}`,
  );
});

Then(
  'current branch verse environment directory should contain the remembered marker',
  async () => {
    const { content, inode, markerPath } = await readVerseEnvironmentMarker();

    assert.ok(
      rememberedEnvironmentMarker,
      'Expected a remembered environment marker before checking reuse',
    );
    assert.strictEqual(
      markerPath,
      rememberedEnvironmentMarker.path,
      `Expected marker path to remain ${rememberedEnvironmentMarker.path}, but found ${markerPath}`,
    );
    assert.strictEqual(
      content,
      rememberedEnvironmentMarker.content,
      `Expected marker content to remain ${rememberedEnvironmentMarker.content}, but found ${content}`,
    );
    assert.strictEqual(
      inode,
      rememberedEnvironmentMarker.inode,
      `Expected marker inode to remain ${rememberedEnvironmentMarker.inode}, but found ${inode}`,
    );
  },
);

Then('verse file for current branch should have one more run', async () => {
  const { verse, versePath } = await readCurrentVerse();

  assert.strictEqual(
    typeof lastObservedRunCount,
    'number',
    'Expected a remembered run count before checking for one more run',
  );
  assert(Array.isArray(verse.runs), `Expected runs array in ${versePath}`);
  assert.strictEqual(
    verse.runs.length,
    lastObservedRunCount + 1,
    `Expected one more run in ${versePath}, but found ${verse.runs.length} after baseline ${lastObservedRunCount}`,
  );
});

Then('the recorded multiverse containers are removed', async () => {
  assert.ok(
    recordedContainerIds.length > 0,
    'Expected at least one recorded container before cleanup',
  );
  const removedIds = await cleanupRecordedMultiverseContainers();

  for (const containerId of removedIds) {
    const { stdout } = await execAsync(
      `docker ps -aq --filter "id=${containerId}" --format "{{.ID}}"`,
    );

    assert.strictEqual(
      stdout.trim(),
      '',
      `Expected observed container ${containerId} to be removed, but it is still present`,
    );
  }
});

Then('latest run in current branch verse should contain finish fields', async () => {
  const { verse, versePath } = await readCurrentVerse();

  assert(
    Array.isArray(verse.runs) && verse.runs.length > 0,
    `Expected at least one run in ${versePath}`,
  );

  const latestRun = verse.runs.at(-1);

  assert.strictEqual(
    typeof latestRun.endAt,
    'string',
    `Expected latest run endAt to be a string in ${versePath}, got ${typeof latestRun.endAt}`,
  );
  assert.strictEqual(
    typeof latestRun.exitCode,
    'number',
    `Expected latest run exitCode to be a number in ${versePath}, got ${typeof latestRun.exitCode}`,
  );
  assert.strictEqual(
    typeof latestRun.containerId,
    'string',
    `Expected latest run containerId to be a string in ${versePath}, got ${typeof latestRun.containerId}`,
  );
});
