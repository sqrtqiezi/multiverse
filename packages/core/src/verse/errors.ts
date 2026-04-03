export class VerseLockTimeoutError extends Error {
  constructor(message = 'Timed out while waiting for verse lock') {
    super(message);
    this.name = 'VerseLockTimeoutError';
  }
}

export class VerseCorruptedError extends Error {
  constructor(message = 'Verse file is corrupted') {
    super(message);
    this.name = 'VerseCorruptedError';
  }
}

export class RunNotFoundError extends Error {
  constructor(message = 'Run not found in verse') {
    super(message);
    this.name = 'RunNotFoundError';
  }
}
