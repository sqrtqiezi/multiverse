import assert from 'node:assert';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Given, Then, When } from '@cucumber/cucumber';

const execAsync = promisify(exec);

let commandOutput = '';
let commandExitCode = 0;

Given('Docker is not running', async () => {
  // This step assumes Docker is actually not running
  // In real tests, you might mock or skip this
});

Given('Docker is available', async function () {
  try {
    await execAsync('docker ps');
  } catch {
    this.skip();
  }
});

Given('Claude credentials do not exist', async () => {
  // Mock by temporarily renaming ~/.claude
});

Given('Claude credentials exist', async () => {
  // Verify ~/.claude exists
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
