export interface SnapshotFile {
  path: string;
  content: string;
}

export interface ConfigSnapshot {
  claudeMd?: string;
  files: SnapshotFile[];
}

export interface ConfigDriftCheckResult {
  templateId: string;
  templateName: string;
  templateFingerprint: string;
  currentFingerprint: string;
  isDrifted: boolean;
  addedFiles: string[];
  modifiedFiles: string[];
  removedFiles: string[];
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  snapshot: ConfigSnapshot;
  fingerprint: string;
  createdAt: string;
}
