import type { Template } from '@multiverse/types';
import { describe, expect, it } from 'vitest';
import { TemplateValidator } from '../template-validator.js';

function validTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'tpl-valid',
    name: 'valid',
    snapshot: {
      claudeMd: '# Config',
      files: [{ path: 'settings.json', content: '{}' }],
    },
    createdAt: '2026-04-07T10:00:00.000Z',
    ...overrides,
  };
}

describe('TemplateValidator', () => {
  const validator = new TemplateValidator();

  describe('validateFormat', () => {
    it('accepts a valid template', () => {
      const result = validator.validateFormat(validTemplate());
      expect(result.valid).toBe(true);
    });

    it('rejects template with empty name', () => {
      const result = validator.validateFormat(validTemplate({ name: '' }));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('name');
    });

    it('rejects template with path traversal in file path', () => {
      const tpl = validTemplate();
      tpl.snapshot.files = [{ path: '../etc/passwd', content: 'x' }];
      const result = validator.validateFormat(tpl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path');
    });

    it('rejects template with absolute file path', () => {
      const tpl = validTemplate();
      tpl.snapshot.files = [{ path: '/etc/passwd', content: 'x' }];
      const result = validator.validateFormat(tpl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path');
    });
  });

  describe('validateIntegrity', () => {
    it('accepts a template with non-empty files', () => {
      const result = validator.validateIntegrity(validTemplate());
      expect(result.valid).toBe(true);
    });

    it('accepts a template with only claudeMd and no files', () => {
      const tpl = validTemplate();
      tpl.snapshot.files = [];
      const result = validator.validateIntegrity(tpl);
      expect(result.valid).toBe(true);
    });

    it('rejects a template with no claudeMd and no files', () => {
      const tpl = validTemplate();
      tpl.snapshot.claudeMd = undefined;
      tpl.snapshot.files = [];
      const result = validator.validateIntegrity(tpl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('rejects a template with file content exceeding 10MB', () => {
      const tpl = validTemplate();
      tpl.snapshot.files = [{ path: 'big.txt', content: 'x'.repeat(10 * 1024 * 1024 + 1) }];
      const result = validator.validateIntegrity(tpl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('big.txt');
    });
  });
});
