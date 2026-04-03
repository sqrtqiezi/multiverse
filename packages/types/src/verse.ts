export interface RunRecord {
  runId: string;
  startAt: string;
  endAt?: string;
  exitCode?: number;
  containerId?: string;
}

export interface Verse {
  schemaVersion: 1;
  id: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
  runs: RunRecord[];
}

export type ArchivedSegment = Record<string, never>;
