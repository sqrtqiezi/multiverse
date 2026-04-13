import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createConfigListParams } from './config-list-params';

describe('createConfigListParams', () => {
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    for (const key of Object.keys(import.meta.env)) {
      delete import.meta.env[key];
    }
    Object.assign(import.meta.env, originalEnv);
  });

  it('does not reference the Node process global', async () => {
    const source = await fs.readFile(
      path.join(import.meta.dirname, 'config-list-params.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/\bprocess\b/);
  });

  it('passes Vite-provided GUI e2e paths when present', () => {
    import.meta.env.VITE_MULTIVERSE_GUI_PROJECT_PATH = '/tmp/project';
    import.meta.env.VITE_MULTIVERSE_GUI_HOME_PATH = '/tmp/home';

    expect(createConfigListParams()).toEqual({
      homePath: '/tmp/home',
      projectPath: '/tmp/project',
    });
  });
});
