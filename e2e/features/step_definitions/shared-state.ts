/**
 * Shared mutable state accessible across step definition files.
 * Cucumber loads all step files in the same process, so module-level
 * exports are a safe way to share state between step definition files.
 */
export const sharedState = {
  commandOutput: '',
  commandExitCode: 0,
};
