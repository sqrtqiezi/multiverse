import { describe, it, expect } from 'vitest';
import { greet } from '../index.js';

describe('core', () => {
  it('should export greet function', () => {
    expect(greet()).toBe('Hello from @multiverse/core');
  });
});
