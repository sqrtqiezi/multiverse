import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('tauri dev script', () => {
  it('passes the workspace root as the GUI project path', async () => {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(import.meta.dirname, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['tauri:dev']).toContain('MULTIVERSE_GUI_PROJECT_PATH=');
    expect(packageJson.scripts['tauri:dev']).toContain('VITE_MULTIVERSE_GUI_PROJECT_PATH=');
    expect(packageJson.scripts['tauri:dev']).toContain('MULTIVERSE_GUI_SERVER_PATH=');
  });
});
