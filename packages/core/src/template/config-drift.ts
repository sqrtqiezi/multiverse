import type { ConfigDriftCheckResult, ConfigSnapshot, Template } from '@multiverse/types';
import { createConfigSnapshot } from './config-snapshot.js';
import { computeSnapshotFingerprint } from './template-fingerprint.js';

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function snapshotToEntries(snapshot: ConfigSnapshot): Map<string, string> {
  const entries = new Map<string, string>();

  if (snapshot.claudeMd !== undefined) {
    entries.set('CLAUDE.md', normalizeLineEndings(snapshot.claudeMd));
  }

  for (const file of snapshot.files) {
    entries.set(`.claude/${normalizePath(file.path)}`, normalizeLineEndings(file.content));
  }

  return entries;
}

export async function checkTemplateDrift({
  homeDir,
  template,
}: {
  homeDir: string;
  template: Template;
}): Promise<ConfigDriftCheckResult> {
  const currentSnapshot = await createConfigSnapshot(homeDir);
  const currentEntries = snapshotToEntries(currentSnapshot);
  const templateEntries = snapshotToEntries(template.snapshot);
  const resolvedTemplateFingerprint =
    template.fingerprint ?? computeSnapshotFingerprint(template.snapshot);
  const currentFingerprint = computeSnapshotFingerprint(currentSnapshot);

  const addedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const removedFiles: string[] = [];

  for (const [path, currentContent] of currentEntries) {
    if (!templateEntries.has(path)) {
      addedFiles.push(path);
      continue;
    }

    const templateContent = templateEntries.get(path);
    if (templateContent !== currentContent) {
      modifiedFiles.push(path);
    }
  }

  for (const path of templateEntries.keys()) {
    if (!currentEntries.has(path)) {
      removedFiles.push(path);
    }
  }

  addedFiles.sort((a, b) => a.localeCompare(b));
  modifiedFiles.sort((a, b) => a.localeCompare(b));
  removedFiles.sort((a, b) => a.localeCompare(b));

  return {
    templateId: template.id,
    templateName: template.name,
    templateFingerprint: resolvedTemplateFingerprint,
    currentFingerprint,
    isDrifted: addedFiles.length > 0 || modifiedFiles.length > 0 || removedFiles.length > 0,
    addedFiles,
    modifiedFiles,
    removedFiles,
  };
}
