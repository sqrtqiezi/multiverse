import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreflightChecker } from '../preflight-checks';
import { ErrorCode } from '../../error-handler/error-codes';
import type { AppError } from '../../error-handler/types';

describe('PreflightChecker', () => {
  let checker: PreflightChecker;

  beforeEach(() => {
    checker = new PreflightChecker();
  });

  describe('checkDockerAvailable', () => {
    it('应该在 Docker 可用时通过检测', async () => {
      const mockExec = vi.fn((cmd, callback) => {
        callback(null, { stdout: 'Docker version 24.0.0', stderr: '' });
      });

      checker = new PreflightChecker({ exec: mockExec });
      await expect(checker.checkDockerAvailable()).resolves.toBeUndefined();
    });

    it('应该在 Docker 不可用时抛出错误', async () => {
      const mockExec = vi.fn((cmd, callback) => {
        callback(new Error('command not found'), { stdout: '', stderr: '' });
      });

      checker = new PreflightChecker({ exec: mockExec });
      await expect(checker.checkDockerAvailable()).rejects.toMatchObject({
        code: ErrorCode.DOCKER_NOT_AVAILABLE,
      } as AppError);
    });
  });

  describe('checkCredentials', () => {
    it('应该在凭证存在时通过检测', async () => {
      const mockAccess = vi.fn((path, callback) => {
        callback(null);
      });

      checker = new PreflightChecker({ fsAccess: mockAccess });
      await expect(checker.checkCredentials()).resolves.toBeUndefined();
    });

    it('应该在凭证不存在时抛出错误', async () => {
      const mockAccess = vi.fn((path, callback) => {
        callback(new Error('ENOENT'));
      });

      checker = new PreflightChecker({ fsAccess: mockAccess });
      await expect(checker.checkCredentials()).rejects.toMatchObject({
        code: ErrorCode.CREDENTIALS_NOT_FOUND,
      } as AppError);
    });
  });

  describe('checkWorkspaceWritable', () => {
    it('应该在工作区可写时通过检测', async () => {
      const mockAccess = vi.fn((path, mode, callback) => {
        callback(null);
      });

      checker = new PreflightChecker({ fsAccess: mockAccess });
      await expect(checker.checkWorkspaceWritable()).resolves.toBeUndefined();
    });

    it('应该在目录不存在时创建目录', async () => {
      const mockAccess = vi.fn((path, mode, callback) => {
        // 第一次调用（F_OK）失败，第二次调用（W_OK）成功
        if (mode === undefined || mode === 0) {
          callback(new Error('ENOENT'));
        } else {
          callback(null);
        }
      });

      const mockMkdir = vi.fn((path, options, callback) => {
        callback(null);
      });

      checker = new PreflightChecker({ fsAccess: mockAccess, fsMkdir: mockMkdir });
      await expect(checker.checkWorkspaceWritable()).resolves.toBeUndefined();
      expect(mockMkdir).toHaveBeenCalled();
    });

    it('应该在工作区不可写时抛出错误', async () => {
      const mockAccess = vi.fn((path, mode, callback) => {
        // 目录存在但不可写
        if (mode === undefined || mode === 0) {
          callback(null);
        } else {
          callback(new Error('EACCES'));
        }
      });

      checker = new PreflightChecker({ fsAccess: mockAccess });
      await expect(checker.checkWorkspaceWritable()).rejects.toMatchObject({
        code: ErrorCode.WORKSPACE_NOT_WRITABLE,
      } as AppError);
    });
  });

  describe('checkDiskSpace', () => {
    it('应该在磁盘空间充足时通过检测', async () => {
      const mockExec = vi.fn((cmd, callback) => {
        // 模拟 df 输出：200MB 可用（204800 KB）
        callback(null, { stdout: '204800', stderr: '' });
      });

      checker = new PreflightChecker({ exec: mockExec });
      await expect(checker.checkDiskSpace()).resolves.toBeUndefined();
    });

    it('应该在磁盘空间不足时抛出错误', async () => {
      const mockExec = vi.fn((cmd, callback) => {
        // 模拟 df 输出：50MB 可用（51200 KB）
        callback(null, { stdout: '51200', stderr: '' });
      });

      checker = new PreflightChecker({ exec: mockExec });
      await expect(checker.checkDiskSpace()).rejects.toMatchObject({
        code: ErrorCode.DISK_SPACE_INSUFFICIENT,
      } as AppError);
    });

    it('应该在命令执行失败时抛出 UNKNOWN_ERROR', async () => {
      const mockExec = vi.fn((cmd, callback) => {
        callback(new Error('command not found'), { stdout: '', stderr: '' });
      });

      checker = new PreflightChecker({ exec: mockExec });
      await expect(checker.checkDiskSpace()).rejects.toMatchObject({
        code: ErrorCode.UNKNOWN_ERROR,
      } as AppError);
    });

    it('应该在输出无法解析时抛出 UNKNOWN_ERROR', async () => {
      const mockExec = vi.fn((cmd, callback) => {
        callback(null, { stdout: 'invalid output', stderr: '' });
      });

      checker = new PreflightChecker({ exec: mockExec });
      await expect(checker.checkDiskSpace()).rejects.toMatchObject({
        code: ErrorCode.UNKNOWN_ERROR,
      } as AppError);
    });
  });

  describe('runAll', () => {
    it('应该按顺序运行所有检测', async () => {
      const mockExec = vi.fn((cmd, callback) => {
        if (cmd.includes('docker')) {
          callback(null, { stdout: 'Docker version 24.0.0', stderr: '' });
        } else {
          callback(null, { stdout: '204800', stderr: '' });
        }
      });

      const mockAccess = vi.fn((path, modeOrCallback, callback?) => {
        const cb = callback || modeOrCallback;
        cb(null);
      });

      checker = new PreflightChecker({ exec: mockExec, fsAccess: mockAccess });
      await expect(checker.runAll()).resolves.toBeUndefined();
    });

    it('应该在任一检测失败时停止并抛出错误', async () => {
      const mockExec = vi.fn((cmd, callback) => {
        callback(new Error('command not found'), { stdout: '', stderr: '' });
      });

      checker = new PreflightChecker({ exec: mockExec });
      await expect(checker.runAll()).rejects.toMatchObject({
        code: ErrorCode.DOCKER_NOT_AVAILABLE,
      } as AppError);
    });
  });
});

