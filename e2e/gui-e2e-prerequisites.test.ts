import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getGuiE2ePrerequisiteError } from './gui-e2e-prerequisites';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

function makeBinDir(executables: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiverse-gui-e2e-bin-'));
  tempDirs.push(dir);

  for (const executable of executables) {
    const executablePath = path.join(dir, executable);
    fs.writeFileSync(executablePath, '#!/bin/sh\n');
    fs.chmodSync(executablePath, 0o755);
  }

  return dir;
}

describe('getGuiE2ePrerequisiteError', () => {
  it('requires tauri-driver', () => {
    expect(getGuiE2ePrerequisiteError({ PATH: makeBinDir(['WebKitWebDriver']) })).toMatch(
      /tauri-driver/,
    );
  });

  it('requires WebKitWebDriver', () => {
    expect(getGuiE2ePrerequisiteError({ PATH: makeBinDir(['tauri-driver']) })).toMatch(
      /WebKitWebDriver/,
    );
  });

  it('passes when both GUI e2e drivers are available', () => {
    expect(
      getGuiE2ePrerequisiteError({ PATH: makeBinDir(['tauri-driver', 'WebKitWebDriver']) }),
    ).toBeUndefined();
  });
});
