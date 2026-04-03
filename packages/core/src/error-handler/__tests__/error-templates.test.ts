import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../error-codes.js';
import { ERROR_TEMPLATES } from '../error-templates.js';

describe('Error Templates', () => {
  it('should have templates for all error codes', () => {
    const errorCodes = Object.values(ErrorCode);
    const templateKeys = Object.keys(ERROR_TEMPLATES);

    expect(templateKeys).toHaveLength(errorCodes.length);
    for (const code of errorCodes) {
      expect(ERROR_TEMPLATES).toHaveProperty(code);
    }
  });

  it('should have all required fields in each template', () => {
    for (const [code, template] of Object.entries(ERROR_TEMPLATES)) {
      expect(template.title, `${code} should have title`).toBeDefined();
      expect(template.description, `${code} should have description`).toBeDefined();
      expect(template.reason, `${code} should have reason`).toBeDefined();
      expect(template.suggestions, `${code} should have suggestions`).toBeDefined();
      expect(template.exitCode, `${code} should have exitCode`).toBeDefined();

      expect(typeof template.title).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(typeof template.reason).toBe('string');
      expect(Array.isArray(template.suggestions)).toBe(true);
      expect(typeof template.exitCode).toBe('number');
    }
  });

  it('should have non-empty title and description', () => {
    for (const [code, template] of Object.entries(ERROR_TEMPLATES)) {
      expect(template.title.length, `${code} title should not be empty`).toBeGreaterThan(0);
      expect(template.description.length, `${code} description should not be empty`).toBeGreaterThan(0);
    }
  });

  it('should have exitCode of 1 for all templates', () => {
    for (const template of Object.values(ERROR_TEMPLATES)) {
      expect(template.exitCode).toBe(1);
    }
  });

  describe('DOCKER_NOT_AVAILABLE template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.DOCKER_NOT_AVAILABLE];

      expect(template.title).toContain('Docker');
      expect(template.description).toBeDefined();
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('docker --version'))).toBe(true);
    });
  });

  describe('DOCKER_PERMISSION_DENIED template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.DOCKER_PERMISSION_DENIED];

      expect(template.title).toContain('权限');
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('usermod -aG docker'))).toBe(true);
    });
  });

  describe('CREDENTIALS_NOT_FOUND template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.CREDENTIALS_NOT_FOUND];

      expect(template.title).toContain('凭证');
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('ANTHROPIC_API_KEY'))).toBe(true);
    });
  });

  describe('CREDENTIALS_INVALID template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.CREDENTIALS_INVALID];

      expect(template.title).toContain('凭证');
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('sk-ant-'))).toBe(true);
    });
  });

  describe('CONTAINER_START_FAILED template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.CONTAINER_START_FAILED];

      expect(template.title).toContain('容器');
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('docker logs'))).toBe(true);
    });
  });

  describe('IMAGE_PULL_FAILED template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.IMAGE_PULL_FAILED];

      expect(template.title).toContain('镜像');
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('docker pull'))).toBe(true);
    });
  });

  describe('WORKSPACE_NOT_WRITABLE template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.WORKSPACE_NOT_WRITABLE];

      expect(template.title).toContain('工作区');
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('chmod'))).toBe(true);
    });
  });

  describe('DISK_SPACE_INSUFFICIENT template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.DISK_SPACE_INSUFFICIENT];

      expect(template.title).toContain('磁盘');
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('docker system prune'))).toBe(true);
    });
  });

  describe('VERSE_FILE_CORRUPTED template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.VERSE_FILE_CORRUPTED];

      expect(template.title).toContain('Verse');
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('.verse.json'))).toBe(true);
    });
  });

  describe('UNKNOWN_ERROR template', () => {
    it('should have correct content', () => {
      const template = ERROR_TEMPLATES[ErrorCode.UNKNOWN_ERROR];

      expect(template.title).toContain('未知');
      expect(template.suggestions).toHaveLength(3);
      expect(template.suggestions.some(s => s.includes('GitHub'))).toBe(true);
    });
  });
});

