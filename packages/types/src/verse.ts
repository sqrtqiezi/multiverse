export interface RunRecord {
  runId: string;
  startAt: string;
  endAt?: string;
  exitCode?: number;
  containerId?: string;
}

export interface VerseEnvironment {
  hostPath: string;
  containerPath: string;
  initializedAt: string;
}

export interface PersistedVerseV1 {
  schemaVersion: 1;
  id: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
  runs: RunRecord[];
}

export interface PersistedVerseV2 {
  schemaVersion: 2;
  id: string;
  branch: string;
  projectRoot: string;
  environment: VerseEnvironment;
  createdAt: string;
  updatedAt: string;
  runs: RunRecord[];
}

export interface Verse {
  schemaVersion: 3;
  id: string;
  branch: string;
  projectRoot: string;
  templateId: string;
  environment: VerseEnvironment;
  createdAt: string;
  updatedAt: string;
  runs: RunRecord[];
}

export type PersistedVerse = PersistedVerseV1 | PersistedVerseV2 | Verse;

export type ArchivedSegment = Record<string, never>;
