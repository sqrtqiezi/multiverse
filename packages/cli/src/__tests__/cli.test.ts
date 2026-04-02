import { describe, it, expect } from 'vitest';
import { run } from '../cli.js';

describe('cli', () => {
  it('should return version string', () => {
    expect(run(['--version'])).toBe('multiverse 0.0.1');
  });
});
