import { describe, expect, it } from 'vitest';
import { createCucumberConfig } from './cucumber-config.mjs';

describe('createCucumberConfig', () => {
  it('excludes GUI scenarios from the plain Cucumber runner', () => {
    expect(createCucumberConfig(['node', 'cucumber-js']).tags).toBe('not @gui');
  });

  it('normalizes requested feature paths from the repository root', () => {
    expect(
      createCucumberConfig(['node', 'cucumber-js', 'e2e/features/start.feature']).paths,
    ).toEqual(['features/start.feature']);
  });
});
