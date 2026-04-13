import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Options } from '@wdio/types';
import { requireTauriDriverPath } from './tauri-driver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tauriDriver: ChildProcess;

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./features/gui.feature'],
  maxInstances: 1,
  capabilities: [
    {
      'tauri:options': {
        application: path.resolve(
          __dirname,
          '../packages/gui/src-tauri/target/debug/multiverse-gui',
        ),
      },
    } as WebdriverIO.Capabilities,
  ],
  logLevel: 'warn',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'cucumber',
  reporters: ['spec'],
  cucumberOpts: {
    file: false,
    paths: ['./features/gui.feature'],
    require: ['./features/step_definitions/gui.steps.ts'],
    requireModule: ['tsx'],
    tags: '@gui',
    timeout: 60000,
  },
  onPrepare: () => {
    tauriDriver = spawn(requireTauriDriverPath(), [], {
      cwd: process.env.MULTIVERSE_GUI_PROJECT_PATH ?? process.cwd(),
      env: process.env,
      stdio: [null, process.stdout, process.stderr],
    });
  },
  onComplete: () => {
    tauriDriver.kill();
  },
  port: 4444,
};
