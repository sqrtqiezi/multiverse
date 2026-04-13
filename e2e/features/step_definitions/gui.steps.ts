import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { After, Before, Given, Then, When } from '@cucumber/cucumber';

let projectDir: string;
let homeDir: string;
const defaultTemplateId = 'default-template';

async function writeDefaultTemplate({
  claudeMd,
  files = [],
}: {
  claudeMd?: string;
  files?: Array<{ path: string; content: string }>;
}) {
  const templatesDir = path.join(homeDir, '.multiverse', 'templates');
  await fs.mkdir(templatesDir, { recursive: true });
  await fs.writeFile(
    path.join(templatesDir, `${defaultTemplateId}.json`),
    JSON.stringify(
      {
        id: defaultTemplateId,
        name: 'default',
        snapshot: {
          ...(claudeMd === undefined ? {} : { claudeMd }),
          files,
        },
        fingerprint: 'e2e-fingerprint',
        createdAt: '2026-04-10T00:00:00.000Z',
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function readDefaultTemplate() {
  const raw = await fs.readFile(
    path.join(homeDir, '.multiverse', 'templates', `${defaultTemplateId}.json`),
    'utf8',
  );
  return JSON.parse(raw) as {
    snapshot: { claudeMd?: string; files: Array<{ path: string; content: string }> };
  };
}

Before({ tags: '@gui' }, async () => {
  const os = await import('node:os');
  const tmpBase =
    process.env.MULTIVERSE_GUI_PROJECT_PATH && process.env.MULTIVERSE_GUI_HOME_PATH
      ? path.dirname(process.env.MULTIVERSE_GUI_PROJECT_PATH)
      : await fs.mkdtemp(path.join(os.tmpdir(), 'multiverse-gui-e2e-'));
  projectDir = process.env.MULTIVERSE_GUI_PROJECT_PATH ?? path.join(tmpBase, 'project');
  homeDir = process.env.MULTIVERSE_GUI_HOME_PATH ?? path.join(tmpBase, 'home');
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.rm(homeDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(path.join(homeDir, '.claude'), { recursive: true });
});

After({ tags: '@gui' }, async () => {
  if (projectDir && !process.env.MULTIVERSE_GUI_PROJECT_PATH) {
    const parent = path.dirname(projectDir);
    await fs.rm(parent, { recursive: true, force: true });
  }
});

Given('a Tauri GUI application is running', async () => {
  // Application is started by WebdriverIO via tauri-driver
  // This step verifies the browser session is active
  await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === 'complete',
    {
      timeout: 10000,
      timeoutMsg: 'Expected Tauri WebView document to finish loading',
    },
  );
});

Given('a default template with CLAUDE.md exists', async () => {
  await writeDefaultTemplate({ claudeMd: '# Project Config\n' });
  await browser.refresh();
  try {
    await browser.waitUntil(
      async () =>
        await browser.execute(() =>
          Array.prototype.slice
            .call(document.querySelectorAll('[data-testid]'))
            .map((element) => element.getAttribute('data-testid'))
            .includes('config-group-模板: default'),
        ),
      { timeout: 10000, timeoutMsg: 'Expected default template config group to render' },
    );
  } catch (error) {
    const bodyText = await $('body').getText();
    const tauriInternals = await browser.execute(() => typeof window.__TAURI_INTERNALS__);
    const testIds = await browser.execute(() =>
      Array.prototype.slice
        .call(document.querySelectorAll('[data-testid]'))
        .map((element) => element.getAttribute('data-testid')),
    );
    const toastText = await browser.execute(() =>
      Array.prototype.slice
        .call(document.querySelectorAll('[data-sonner-toast]'))
        .map((element) => element.textContent ?? ''),
    );
    throw new Error(
      `Default template config group did not render. body=${bodyText} tauriInternals=${tauriInternals} testIds=${testIds.join(',')} toasts=${toastText.join(' | ')} cause=${error}`,
    );
  }
});

Given('CLAUDE.md contains {string}', async (content: string) => {
  await writeDefaultTemplate({ claudeMd: content });
});

Given('the default template has no config files', async () => {
  await writeDefaultTemplate({});
  await browser.refresh();
  const createButton = await $('[data-testid="config-create-CLAUDE.md"]');
  await createButton.waitForDisplayed({ timeout: 10000 });
});

Then('the window title should be {string}', async (expectedTitle: string) => {
  const title = await browser.execute(() => document.title);
  assert.strictEqual(title, expectedTitle);
});

Then('the sidebar should be visible', async () => {
  const sidebar = await $('[data-testid="config-sidebar"]');
  assert(await sidebar.isDisplayed(), 'Sidebar should be visible');
});

Then('no runtime error notification should appear', async () => {
  const toasts = await $$('[data-sonner-toast]');
  for (const toast of toasts) {
    const text = await toast.getText();
    assert(!text.includes('ReferenceError'), `Unexpected runtime error notification: ${text}`);
  }
});

Then('the sidebar should display {string} group', async (groupLabel: string) => {
  const group = await $(`[data-testid="config-group-${groupLabel}"]`);
  assert(await group.isDisplayed(), `Group "${groupLabel}" should be visible`);
});

Then('the sidebar should contain {string}', async (fileName: string) => {
  const file = await $(`[data-testid="config-file-${fileName}"]`);
  assert(await file.isDisplayed(), `File "${fileName}" should be in the sidebar`);
});

Then('the sidebar should offer to create {string}', async (fileName: string) => {
  const createButton = await $(`[data-testid="config-create-${fileName}"]`);
  await createButton.waitForDisplayed({ timeout: 10000 });
  assert(await createButton.isDisplayed(), `Create button for "${fileName}" should be visible`);
});

When('I click {string} in the sidebar', async (fileName: string) => {
  const file = await $(`[data-testid="config-file-${fileName}"]`);
  await file.waitForClickable({ timeout: 10000 });
  await file.click();
});

Then('the editor should display the contents of CLAUDE.md', async () => {
  // Wait for Monaco to load content
  await browser.pause(1000);
  const editor = await $('[data-testid="editor-panel"]');
  assert(await editor.isDisplayed(), 'Editor panel should be visible');
});

When('I clear the editor and type {string}', async (text: string) => {
  const textarea = await $('.monaco-editor textarea');
  await textarea.waitForDisplayed({ timeout: 10000 });
  await textarea.click();
  await browser.keys(['Control', 'a']);
  await browser.keys(text);

  const saveBtn = await $('[data-testid="save-button"]');
  await browser.waitUntil(async () => !(await saveBtn.getAttribute('disabled')), {
    timeout: 5000,
    timeoutMsg: 'Expected save button to become enabled after editor content changed',
  });
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
  const template = await readDefaultTemplate();
  const content = template.snapshot.claudeMd ?? '';
  assert(
    content.includes(expected),
    `Expected CLAUDE.md to contain "${expected}", got: ${content}`,
  );
});
