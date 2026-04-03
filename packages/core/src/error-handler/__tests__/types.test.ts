import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../error-codes.js';
import type { AppError, ErrorTemplate, FormattedError } from '../types.js';

describe('Error Types', () => {
  it('should create AppError with required fields', () => {
    const error: AppError = {
      code: ErrorCode.DOCKER_NOT_AVAILABLE,
    };

    expect(error.code).toBe(ErrorCode.DOCKER_NOT_AVAILABLE);
    expect(error.cause).toBeUndefined();
    expect(error.context).toBeUndefined();
  });

  it('should create AppError with optional fields', () => {
    const cause = new Error('test');
    const error: AppError = {
      code: ErrorCode.DOCKER_NOT_AVAILABLE,
      cause,
      context: { path: '/test' },
    };

    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ path: '/test' });
  });

  it('should create FormattedError with all fields', () => {
    const formatted: FormattedError = {
      title: 'Test Error',
      description: 'Test description',
      reason: 'Test reason',
      suggestions: ['suggestion 1', 'suggestion 2'],
      exitCode: 1,
    };

    expect(formatted.title).toBe('Test Error');
    expect(formatted.suggestions).toHaveLength(2);
  });

  it('should create AppError with empty context', () => {
    const error: AppError = {
      code: ErrorCode.DOCKER_NOT_AVAILABLE,
      context: {},
    };

    expect(error.context).toEqual({});
  });

  it('should create FormattedError with empty suggestions', () => {
    const formatted: FormattedError = {
      title: 'Test Error',
      description: 'Test description',
      suggestions: [],
      exitCode: 1,
    };

    expect(formatted.suggestions).toHaveLength(0);
  });

  it('should create FormattedError with undefined reason', () => {
    const formatted: FormattedError = {
      title: 'Test Error',
      description: 'Test description',
      reason: undefined,
      suggestions: ['suggestion'],
      exitCode: 1,
    };

    expect(formatted.reason).toBeUndefined();
  });

  it('should create ErrorTemplate with all fields', () => {
    const template: ErrorTemplate = {
      title: 'Template Error',
      description: 'Template description',
      reason: 'Template reason',
      suggestions: ['template suggestion'],
      exitCode: 1,
    };

    expect(template.title).toBe('Template Error');
    expect(template.reason).toBe('Template reason');
    expect(template.suggestions).toHaveLength(1);
    expect(template.exitCode).toBe(1);
  });
});
