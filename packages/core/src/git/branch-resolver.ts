import { execFile } from 'node:child_process';

export class BranchResolver {
  async getCurrentBranch(cwd: string): Promise<string> {
    const branchName = await this.runGitCommand(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);

    if (branchName === 'HEAD') {
      const shortCommit = await this.runGitCommand(cwd, ['rev-parse', '--short', 'HEAD']);
      return `detached-${shortCommit}`;
    }

    return branchName;
  }

  protected async runGitCommand(cwd: string, args: string[]): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      execFile('git', args, { cwd }, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(stdout.trim());
      });
    });
  }
}
