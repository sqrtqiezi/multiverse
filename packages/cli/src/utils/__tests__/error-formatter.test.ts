import { ErrorCode, type FormattedError } from '@multiverse/core';
import { describe, expect, it } from 'vitest';
import { formatErrorOutput, toAppError } from '../error-formatter.js';

describe('formatErrorOutput', () => {
  it('应该格式化包含所有字段的错误', () => {
    const formatted: FormattedError = {
      title: '配置文件无效',
      description: '无法解析 multiverse.json',
      reason: '文件包含语法错误',
      suggestions: ['检查 JSON 语法', '使用 JSON 验证工具'],
      exitCode: 1,
    };

    const output = formatErrorOutput(formatted);

    expect(output).toContain('❌');
    expect(output).toContain('配置文件无效');
    expect(output).toContain('无法解析 multiverse.json');
    expect(output).toContain('文件包含语法错误');
    expect(output).toContain('💡 解决建议：');
    expect(output).toContain('1. 检查 JSON 语法');
    expect(output).toContain('2. 使用 JSON 验证工具');
  });

  it('应该正确处理没有 reason 的错误', () => {
    const formatted: FormattedError = {
      title: 'Docker 未运行',
      description: '无法连接到 Docker daemon',
      suggestions: ['启动 Docker Desktop'],
      exitCode: 1,
    };

    const output = formatErrorOutput(formatted);

    expect(output).toContain('❌');
    expect(output).toContain('Docker 未运行');
    expect(output).toContain('无法连接到 Docker daemon');
    expect(output).toContain('💡 解决建议：');
    expect(output).toContain('1. 启动 Docker Desktop');
    expect(output).not.toContain('undefined');
  });

  it('应该正确格式化多条建议', () => {
    const formatted: FormattedError = {
      title: '错误标题',
      description: '错误描述',
      suggestions: ['建议1', '建议2', '建议3'],
      exitCode: 1,
    };

    const output = formatErrorOutput(formatted);

    expect(output).toContain('1. 建议1');
    expect(output).toContain('2. 建议2');
    expect(output).toContain('3. 建议3');
  });

  it('应该在 suggestions 为空数组时隐藏解决建议标题', () => {
    const formatted: FormattedError = {
      title: '未知错误',
      description: '发生了未知错误',
      suggestions: [],
      exitCode: 1,
    };

    const output = formatErrorOutput(formatted);

    expect(output).toContain('❌');
    expect(output).toContain('未知错误');
    expect(output).toContain('发生了未知错误');
    expect(output).not.toContain('💡 解决建议：');
  });
});

describe('toAppError', () => {
  it('应该直接返回有效的 AppError', () => {
    const appError = {
      code: ErrorCode.DOCKER_NOT_AVAILABLE,
      message: 'Docker is not available',
    };

    const result = toAppError(appError);

    expect(result).toBe(appError);
  });

  it('应该将含有无效 code 的对象转换为 UNKNOWN_ERROR', () => {
    const invalidError = {
      code: 'NOT_A_REAL_ERROR_CODE',
      message: 'This has an invalid code',
    };

    const result = toAppError(invalidError);

    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(result.message).toContain('Unknown error');
  });

  it('应该将 Error 转换为 UNKNOWN_ERROR', () => {
    const error = new Error('Something went wrong');

    const result = toAppError(error);

    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(result.cause).toBe(error);
  });

  it('应该将字符串转换为 UNKNOWN_ERROR', () => {
    const result = toAppError('error string');

    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(result.message).toBe('error string');
  });

  it('应该将未知类型转换为 UNKNOWN_ERROR', () => {
    const result = toAppError({ foo: 'bar' });

    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(result.message).toContain('Unknown error');
  });

  it('应该将所有有效的 ErrorCode 识别为 AppError', () => {
    for (const code of Object.values(ErrorCode)) {
      const appError = { code };
      const result = toAppError(appError);
      expect(result).toBe(appError);
    }
  });
});
