import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../error-codes';
import { ErrorHandler } from '../error-handler';
import { ERROR_TEMPLATES } from '../error-templates';
import type { AppError } from '../types';

describe('ErrorHandler', () => {
  const handler = new ErrorHandler();

  describe('format()', () => {
    it('should format error with basic template', () => {
      const error: AppError = {
        code: ErrorCode.DOCKER_NOT_AVAILABLE,
        message: 'Docker not available',
      };

      const formatted = handler.format(error);

      expect(formatted.title).toBe('Docker 不可用');
      expect(formatted.description).toBe(
        '无法连接到 Docker 守护进程。Multiverse 需要 Docker 来运行 Verse 容器。',
      );
      expect(formatted.suggestions).toBeInstanceOf(Array);
      expect(formatted.suggestions).toHaveLength(3);
      expect(formatted.exitCode).toBe(1);
    });

    it('should include reason field when present in template', () => {
      const error: AppError = {
        code: ErrorCode.CREDENTIALS_INVALID,
        message: 'Invalid credentials',
      };

      const formatted = handler.format(error);

      expect(formatted.reason).toBeDefined();
      expect(typeof formatted.reason).toBe('string');
    });

    it('should handle unknown error code with fallback', () => {
      const error: AppError = {
        code: 'NONEXISTENT_CODE' as ErrorCode,
        message: 'Unknown error',
      };

      const formatted = handler.format(error);

      expect(formatted.title).toBe('未知错误');
      expect(formatted.exitCode).toBe(1);
    });

    it('should handle missing context gracefully', () => {
      const error: AppError = {
        code: ErrorCode.DOCKER_NOT_AVAILABLE,
        message: 'Docker not available',
        // no context provided
      };

      const formatted = handler.format(error);

      expect(formatted.description).toBeDefined();
      expect(formatted.suggestions).toBeInstanceOf(Array);
    });

    it('should replace variables in description with context values', () => {
      const error: AppError = {
        code: ErrorCode.CONTAINER_START_FAILED,
        message: 'Container failed to start',
        context: { port: '8080', containerId: 'abc123' },
      };

      // 临时修改模板以测试变量替换
      const originalTemplate = ERROR_TEMPLATES[ErrorCode.CONTAINER_START_FAILED];
      ERROR_TEMPLATES[ErrorCode.CONTAINER_START_FAILED] = {
        ...originalTemplate,
        description: '容器 {containerId} 在端口 {port} 启动失败',
      };

      const formatted = handler.format(error);

      expect(formatted.description).toBe('容器 abc123 在端口 8080 启动失败');

      // 恢复原始模板
      ERROR_TEMPLATES[ErrorCode.CONTAINER_START_FAILED] = originalTemplate;
    });

    it('should replace variables in suggestions with context values', () => {
      const error: AppError = {
        code: ErrorCode.WORKSPACE_NOT_WRITABLE,
        message: 'Workspace not writable',
        context: { path: '/home/user/workspace' },
      };

      // 临时修改模板以测试变量替换
      const originalTemplate = ERROR_TEMPLATES[ErrorCode.WORKSPACE_NOT_WRITABLE];
      ERROR_TEMPLATES[ErrorCode.WORKSPACE_NOT_WRITABLE] = {
        ...originalTemplate,
        suggestions: ['检查目录权限：ls -la {path}', '修改目录权限：chmod u+w {path}'],
      };

      const formatted = handler.format(error);

      expect(formatted.suggestions).toHaveLength(2);
      expect(formatted.suggestions[0]).toBe('检查目录权限：ls -la /home/user/workspace');
      expect(formatted.suggestions[1]).toBe('修改目录权限：chmod u+w /home/user/workspace');

      // 恢复原始模板
      ERROR_TEMPLATES[ErrorCode.WORKSPACE_NOT_WRITABLE] = originalTemplate;
    });

    it('should handle multiple occurrences of same variable', () => {
      const error: AppError = {
        code: ErrorCode.DOCKER_NOT_AVAILABLE,
        message: 'Docker not available',
        context: { service: 'Docker' },
      };

      // 临时修改模板以测试变量替换
      const originalTemplate = ERROR_TEMPLATES[ErrorCode.DOCKER_NOT_AVAILABLE];
      ERROR_TEMPLATES[ErrorCode.DOCKER_NOT_AVAILABLE] = {
        ...originalTemplate,
        description: '{service} 不可用，请启动 {service} 服务',
      };

      const formatted = handler.format(error);

      expect(formatted.description).toBe('Docker 不可用，请启动 Docker 服务');

      // 恢复原始模板
      ERROR_TEMPLATES[ErrorCode.DOCKER_NOT_AVAILABLE] = originalTemplate;
    });
  });
});
