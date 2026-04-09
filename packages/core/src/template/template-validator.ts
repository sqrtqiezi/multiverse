import * as path from 'node:path';
import type { Template } from '@multiverse/types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export class TemplateValidator {
  validateFormat(template: Template): ValidationResult {
    if (!template.id) {
      return { valid: false, error: 'Missing required field: id' };
    }
    if (!template.name) {
      return { valid: false, error: 'Missing required field: name' };
    }
    if (!template.snapshot) {
      return { valid: false, error: 'Missing required field: snapshot' };
    }

    for (const file of template.snapshot.files) {
      if (file.path.includes('..') || path.isAbsolute(file.path)) {
        return { valid: false, error: `Invalid file path: ${file.path}` };
      }
    }

    return { valid: true };
  }

  validateIntegrity(template: Template): ValidationResult {
    const hasClaudeMd =
      template.snapshot.claudeMd !== undefined && template.snapshot.claudeMd.length > 0;
    const hasFiles = template.snapshot.files.length > 0;

    if (!hasClaudeMd && !hasFiles) {
      return {
        valid: false,
        error: 'Template snapshot is empty: no claudeMd and no files',
      };
    }

    for (const file of template.snapshot.files) {
      if (file.content.length > MAX_FILE_SIZE) {
        return {
          valid: false,
          error: `File too large: ${file.path} (${file.content.length} bytes)`,
        };
      }
    }

    return { valid: true };
  }
}
