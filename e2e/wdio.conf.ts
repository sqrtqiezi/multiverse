import type { Options } from '@wdio/types';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tauriDriver: ChildProcess;

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./features/step_definitions/gui.steps.ts'],
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
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  onPrepare: () => {
    tauriDriver = spawn('tauri-driver', [], {
      stdio: [null, process.stdout, process.stderr],
    });
  },
  onComplete: () => {
    tauriDriver.kill();
  },
  port: 4444,
};
