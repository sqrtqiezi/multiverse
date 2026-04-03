import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchResolver } from '../branch-resolver.js';

let gitBranchOutput = 'feature/story-1\n';
let gitShortShaOutput = 'abc1234\n';

vi.mock('node:child_process', () => {
  return {
    execFile: vi.fn(
      (
        command: string,
        args: string[],
        optionsOrCallback:
          | ((error: Error | null, stdout: string, stderr: string) => void)
          | Record<string, unknown>,
        maybeCallback?: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const callback =
          typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;

        if (!callback) {
          throw new Error('Missing callback');
        }

        const gitCommand = [command, ...args].join(' ');

        if (gitCommand === 'git rev-parse --abbrev-ref HEAD') {
          callback(null, gitBranchOutput, '');
          return;
        }

        if (gitCommand === 'git rev-parse --short HEAD') {
          callback(null, gitShortShaOutput, '');
          return;
        }

        callback(new Error(`Unexpected git command: ${gitCommand}`), '', '');
      },
    ),
  };
});

describe('BranchResolver', () => {
  beforeEach(() => {
    gitBranchOutput = 'feature/story-1\n';
    gitShortShaOutput = 'abc1234\n';
  });

  it('returns the current branch name from git', async () => {
    const resolver = new BranchResolver();

    await expect(resolver.getCurrentBranch(process.cwd())).resolves.toBe('feature/story-1');
  });

  it('maps detached HEAD to detached-<shortCommit>', async () => {
    const resolver = new BranchResolver();

    gitBranchOutput = 'HEAD\n';
    gitShortShaOutput = 'abc1234\n';

    const branch = await resolver.getCurrentBranch(process.cwd());

    expect(branch).toBe('detached-abc1234');
    expect(branch).toHaveLength('detached-abc1234'.length);
  });
});
