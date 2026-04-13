import fs from 'node:fs';
import path from 'node:path';

export function resolveExecutablePath(command: string, searchPath: string): string | undefined {
  for (const dir of searchPath.split(path.delimiter)) {
    if (!dir) continue;

    const candidate = path.join(dir, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Keep searching. Some developer PATH entries can be missing or unreadable.
    }
  }

  return undefined;
}

export function resolveTauriDriverPath(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.TAURI_DRIVER) {
    return env.TAURI_DRIVER;
  }

  return resolveExecutablePath('tauri-driver', env.PATH ?? '');
}

export function requireTauriDriverPath(env: NodeJS.ProcessEnv = process.env): string {
  const driverPath = resolveTauriDriverPath(env);
  if (driverPath) {
    return driverPath;
  }

  throw new Error(
    'tauri-driver is required for GUI e2e tests. Install it with `cargo install tauri-driver` or set TAURI_DRIVER to the executable path.',
  );
}
