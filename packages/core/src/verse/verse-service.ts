import * as fs from 'node:fs/promises';
import type { Verse } from '@multiverse/types';
import { BranchResolver } from '../git/branch-resolver.js';
import { RunNotFoundError } from './errors.js';
import { getVersePath } from './verse-path.js';
import { VerseRepository } from './verse-repository.js';

type AppendRunStartInput = {
  cwd: string;
  runId: string;
  startAt: string;
  templateId: string;
};

type FinalizeRunInput = {
  cwd: string;
  runId: string;
  endAt: string;
  exitCode: number;
  containerId: string;
  templateId: string;
};

export class VerseService {
  constructor(private readonly branchResolver = new BranchResolver()) {}

  async ensureVerseForCurrentBranch(cwd: string, templateId: string): Promise<Verse> {
    const branch = await this.branchResolver.getCurrentBranch(cwd);
    const repository = new VerseRepository(cwd);
    return await repository.writeVerse({
      branch,
      templateId,
      mutate: () => undefined,
    });
  }

  async updateTemplateForCurrentBranch(cwd: string, templateId: string): Promise<Verse> {
    const branch = await this.branchResolver.getCurrentBranch(cwd);
    const repository = new VerseRepository(cwd);

    return await repository.writeVerse({
      branch,
      templateId,
      mutate: (verse) => {
        verse.templateId = templateId;
      },
    });
  }

  async appendRunStart({ cwd, runId, startAt, templateId }: AppendRunStartInput): Promise<Verse> {
    const branch = await this.branchResolver.getCurrentBranch(cwd);
    const repository = new VerseRepository(cwd);

    return await repository.writeVerse({
      branch,
      templateId,
      mutate: (verse) => {
        verse.runs.push({
          runId,
          startAt,
        });
      },
    });
  }

  async finalizeRun({
    cwd,
    runId,
    endAt,
    exitCode,
    containerId,
    templateId,
  }: FinalizeRunInput): Promise<Verse> {
    const branch = await this.branchResolver.getCurrentBranch(cwd);
    const versePath = getVersePath(cwd, branch);

    try {
      await fs.access(versePath);
    } catch {
      throw new RunNotFoundError();
    }

    const repository = new VerseRepository(cwd);
    return await repository.writeVerse({
      branch,
      templateId,
      mutate: (verse) => {
        const run = verse.runs.find((entry) => entry.runId === runId);

        if (!run) {
          throw new RunNotFoundError();
        }

        run.endAt = endAt;
        run.exitCode = exitCode;
        run.containerId = containerId;
      },
    });
  }
}
