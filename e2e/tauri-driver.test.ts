import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { requireTauriDriverPath, resolveTauriDriverPath } from './tauri-driver';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.chmodSync(dir, 0o700);
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiverse-tauri-driver-'));
  tempDirs.push(dir);
  return dir;
}

describe('resolveTauriDriverPath', () => {
  it('skips inaccessible PATH entries and finds an executable tauri-driver', () => {
    const blockedDir = makeTempDir();
    const binDir = makeTempDir();
    const driverPath = path.join(binDir, 'tauri-driver');
    fs.writeFileSync(driverPath, '#!/bin/sh\n');
    fs.chmodSync(driverPath, 0o755);
    fs.chmodSync(blockedDir, 0o000);

    const resolved = resolveTauriDriverPath({
      PATH: `${blockedDir}${path.delimiter}${binDir}`,
    });

    expect(resolved).toBe(driverPath);
  });

  it('uses TAURI_DRIVER when provided', () => {
    expect(resolveTauriDriverPath({ TAURI_DRIVER: '/opt/bin/tauri-driver' })).toBe(
      '/opt/bin/tauri-driver',
    );
  });

  it('explains how to install tauri-driver when it cannot be resolved', () => {
    expect(() => requireTauriDriverPath({ PATH: makeTempDir() })).toThrow(/cargo install/);
  });
});
