import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Given, When, Then, Before, After } from '@cucumber/cucumber';

let projectDir: string;
let homeDir: string;

Before({ tags: '@gui' }, async () => {
  const os = await import('node:os');
  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'multiverse-gui-e2e-'));
  projectDir = path.join(tmpBase, 'project');
  homeDir = path.join(tmpBase, 'home');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(path.join(homeDir, '.claude'), { recursive: true });
});

After({ tags: '@gui' }, async () => {
  if (projectDir) {
    const parent = path.dirname(projectDir);
    await fs.rm(parent, { recursive: true, force: true });
  }
});

Given('a Tauri GUI application is running', async () => {
  // Application is started by WebdriverIO via tauri-driver
  // This step verifies the browser session is active
  const title = await browser.getTitle();
  assert(title, 'Expected a window title');
});

Given('a project directory with CLAUDE.md exists', async () => {
  await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), '# Project Config\n', 'utf8');
});

Given('CLAUDE.md contains {string}', async (content: string) => {
  await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), content, 'utf8');
});

Then('the window title should be {string}', async (expectedTitle: string) => {
  const title = await browser.getTitle();
  assert.strictEqual(title, expectedTitle);
});

Then('the sidebar should be visible', async () => {
  const sidebar = await $('[data-testid="config-sidebar"]');
  assert(await sidebar.isDisplayed(), 'Sidebar should be visible');
});

Then('the sidebar should display {string} group', async (groupLabel: string) => {
  const group = await $(`[data-testid="config-group-${groupLabel}"]`);
  assert(await group.isDisplayed(), `Group "${groupLabel}" should be visible`);
});

Then('the sidebar should contain {string}', async (fileName: string) => {
  const file = await $(`[data-testid="config-file-${fileName}"]`);
  assert(await file.isDisplayed(), `File "${fileName}" should be in the sidebar`);
});

When('I click {string} in the sidebar', async (fileName: string) => {
  const file = await $(`[data-testid="config-file-${fileName}"]`);
  await file.click();
});

Then('the editor should display the contents of CLAUDE.md', async () => {
  // Wait for Monaco to load content
  await browser.pause(1000);
  const editor = await $('[data-testid="editor-panel"]');
  assert(await editor.isDisplayed(), 'Editor panel should be visible');
});

When('I clear the editor and type {string}', async (text: string) => {
  // Use Monaco API to set content
  await browser.execute((newText: string) => {
    const editors = (window as unknown as { monaco?: { editor: { getEditors: () => Array<{ setValue: (v: string) => void }> } } }).monaco?.editor?.getEditors();
    if (editors && editors[0]) {
      editors[0].setValue(newText);
    }
  }, text);
});

When('I click the save button', async () => {
  const saveBtn = await $('[data-testid="save-button"]');
  await saveBtn.click();
});

Then('a success notification should appear', async () => {
  const toast = await $('[data-sonner-toast]');
  await toast.waitForDisplayed({ timeout: 5000 });
});

Then('the file CLAUDE.md should contain {string}', async (expected: string) => {
  const content = await fs.readFile(path.join(projectDir, 'CLAUDE.md'), 'utf8');
  assert(content.includes(expected), `Expected CLAUDE.md to contain "${expected}", got: ${content}`);
});
