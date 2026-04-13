import { resolveExecutablePath, resolveTauriDriverPath } from './tauri-driver.js';

export function getGuiE2ePrerequisiteError(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!resolveTauriDriverPath(env)) {
    return 'tauri-driver is required for GUI e2e tests. Install it with `cargo install tauri-driver` or set TAURI_DRIVER to the executable path.';
  }

  if (!resolveExecutablePath('WebKitWebDriver', env.PATH ?? '')) {
    return 'WebKitWebDriver is required for GUI e2e tests on Linux. Install the system package `webkit2gtk-driver`.';
  }

  return undefined;
}
