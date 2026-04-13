import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGuiE2ePrerequisiteError } from './gui-e2e-prerequisites.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

async function waitForUrl(url: string, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function stopProcess(child: ChildProcess) {
  if (!child.killed) {
    child.kill();
  }
}

const prerequisiteError = getGuiE2ePrerequisiteError();

if (process.env.MULTIVERSE_GUI_E2E !== '1' && process.env.MULTIVERSE_GUI_E2E_REQUIRED !== '1') {
  console.warn('Skipping GUI e2e tests: set MULTIVERSE_GUI_E2E=1 to run the desktop suite.');
  process.exit(0);
}

if (prerequisiteError) {
  if (process.env.MULTIVERSE_GUI_E2E_REQUIRED === '1') {
    console.error(prerequisiteError);
    process.exit(1);
  }

  console.warn(`Skipping GUI e2e tests: ${prerequisiteError}`);
  process.exit(0);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'multiverse-gui-e2e-'));
const projectPath = path.join(tempRoot, 'project');
const homePath = path.join(tempRoot, 'home');
fs.mkdirSync(projectPath, { recursive: true });
fs.mkdirSync(path.join(homePath, '.claude'), { recursive: true });

const guiEnv = {
  ...process.env,
  MULTIVERSE_GUI_HOME_PATH: homePath,
  MULTIVERSE_GUI_PROJECT_PATH: projectPath,
  MULTIVERSE_GUI_SERVER_PATH: path.join(repoRoot, 'packages/gui-server/dist/index.js'),
  VITE_MULTIVERSE_GUI_HOME_PATH: homePath,
  VITE_MULTIVERSE_GUI_PROJECT_PATH: projectPath,
};

const buildResult = spawnSync('pnpm', ['--filter', '@multiverse/gui', 'build'], {
  cwd: repoRoot,
  env: guiEnv,
  stdio: 'inherit',
});

if (buildResult.error) {
  console.error(buildResult.error.message);
  fs.rmSync(tempRoot, { force: true, recursive: true });
  process.exit(1);
}

if (buildResult.status !== 0) {
  fs.rmSync(tempRoot, { force: true, recursive: true });
  process.exit(buildResult.status ?? 1);
}

const vite = spawn(
  path.join(repoRoot, 'packages/gui/node_modules/.bin/vite'),
  ['--host', '127.0.0.1'],
  {
    cwd: path.join(repoRoot, 'packages/gui'),
    env: guiEnv,
    stdio: ['ignore', 'inherit', 'inherit'],
  },
);

let exitCode = 1;

try {
  await waitForUrl('http://localhost:5173/');

  const result = spawnSync('pnpm', ['wdio', 'run', 'wdio.conf.ts'], {
    env: guiEnv,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    exitCode = 1;
  } else {
    exitCode = result.status ?? 1;
  }
} finally {
  stopProcess(vite);
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

process.exit(exitCode);
