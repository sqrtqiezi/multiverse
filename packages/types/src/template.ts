export interface SnapshotFile {
  path: string;
  content: string;
}

export interface ConfigSnapshot {
  claudeMd?: string;
  files: SnapshotFile[];
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  snapshot: ConfigSnapshot;
  createdAt: string;
}
