import type { ConfigSnapshot } from '@multiverse/types';
import { describe, expect, it } from 'vitest';
import { computeSnapshotFingerprint } from '../template-fingerprint.js';

function snapshot(overrides: Partial<ConfigSnapshot> = {}): ConfigSnapshot {
  return {
    claudeMd: '# Claude\nline 2',
    files: [
      { path: 'b.txt', content: 'bravo\r\nsecond line' },
      { path: 'a.txt', content: 'alpha\nsecond line' },
    ],
    ...overrides,
  };
}

describe('computeSnapshotFingerprint', () => {
  it('returns the same fingerprint for identical snapshots', () => {
    const first = computeSnapshotFingerprint(snapshot());
    const second = computeSnapshotFingerprint(snapshot());

    expect(first).toBe(second);
  });

  it('is stable when file order changes', () => {
    const first = computeSnapshotFingerprint(snapshot());
    const second = computeSnapshotFingerprint({
      claudeMd: '# Claude\nline 2',
      files: [
        { path: 'a.txt', content: 'alpha\nsecond line' },
        { path: 'b.txt', content: 'bravo\r\nsecond line' },
      ],
    });

    expect(first).toBe(second);
  });

  it('normalizes line endings before fingerprinting', () => {
    const first = computeSnapshotFingerprint(
      snapshot({
        claudeMd: '# Claude\r\nline 2',
        files: [{ path: 'note.txt', content: 'line 1\r\nline 2' }],
      }),
    );
    const second = computeSnapshotFingerprint(
      snapshot({
        claudeMd: '# Claude\nline 2',
        files: [{ path: 'note.txt', content: 'line 1\nline 2' }],
      }),
    );

    expect(first).toBe(second);
  });

  it('changes when snapshot content changes', () => {
    const first = computeSnapshotFingerprint(snapshot());
    const second = computeSnapshotFingerprint(
      snapshot({
        files: [
          { path: 'a.txt', content: 'alpha\nsecond line changed' },
          { path: 'b.txt', content: 'bravo\r\nsecond line' },
        ],
      }),
    );

    expect(first).not.toBe(second);
  });
});
