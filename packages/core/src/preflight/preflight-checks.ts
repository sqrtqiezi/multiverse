import { exec as nodeExec } from 'node:child_process';
import { access as nodeAccess, constants, mkdir as nodeMkdir } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ErrorCode } from '../error-handler/error-codes.js';
import type { AppError } from '../error-handler/types.js';

interface PreflightDependencies {
  exec?: typeof nodeExec;
  fsAccess?: typeof nodeAccess;
  fsMkdir?: typeof nodeMkdir;
}

export class PreflightChecker {
  private exec: typeof nodeExec;
  private fsAccess: typeof nodeAccess;
  private fsMkdir: typeof nodeMkdir;

  constructor(deps?: PreflightDependencies) {
    this.exec = deps?.exec || nodeExec;
    this.fsAccess = deps?.fsAccess || nodeAccess;
    this.fsMkdir = deps?.fsMkdir || nodeMkdir;
  }

  async checkDockerAvailable(): Promise<void> {
    const execAsync = promisify(this.exec);

    try {
      await execAsync('docker version');
    } catch (error) {
      throw {
        code: ErrorCode.DOCKER_NOT_AVAILABLE,
        message: 'Docker is not available',
        cause: error as Error,
      } as AppError;
    }
  }

  async checkCredentials(): Promise<void> {
    const accessAsync = promisify(this.fsAccess);
    const claudeDir = join(homedir(), '.claude');

    try {
      await accessAsync(claudeDir);
    } catch (error) {
      throw {
        code: ErrorCode.CREDENTIALS_NOT_FOUND,
        message: 'Claude credentials not found',
        cause: error as Error,
        context: { path: claudeDir },
      } as AppError;
    }
  }

  async checkWorkspaceWritable(): Promise<void> {
    const accessAsync = promisify(this.fsAccess);
    const mkdirAsync = promisify(this.fsMkdir);
    const workspaceDir = join(process.cwd(), '.multiverse');

    try {
      // 尝试访问目录，如果不存在则创建
      try {
        await accessAsync(workspaceDir, constants.F_OK);
      } catch {
        // 目录不存在，尝试创建
        await mkdirAsync(workspaceDir, { recursive: true });
      }

      // 检测目录是否可写
      await accessAsync(workspaceDir, constants.W_OK);
    } catch (error) {
      throw {
        code: ErrorCode.WORKSPACE_NOT_WRITABLE,
        message: 'Workspace directory is not writable',
        cause: error as Error,
        context: { path: workspaceDir },
      } as AppError;
    }
  }

  async checkDiskSpace(): Promise<void> {
    const execAsync = promisify(this.exec);
    const minSpaceKB = 100 * 1024; // 100MB in KB
    const currentPlatform = platform();

    // Windows 平台跳过磁盘空间检测
    if (currentPlatform === 'win32') {
      return;
    }

    try {
      const { stdout } = await execAsync(
        `df -k "${process.cwd()}" | tail -1 | awk '{print $4}'`
      );
      const availableKB = Number.parseInt(stdout.trim(), 10);

      if (Number.isNaN(availableKB)) {
        throw {
          code: ErrorCode.UNKNOWN_ERROR,
          message: 'Failed to parse disk space output',
          context: { stdout },
        } as AppError;
      }

      if (availableKB < minSpaceKB) {
        throw {
          code: ErrorCode.DISK_SPACE_INSUFFICIENT,
          message: 'Insufficient disk space',
          context: {
            available: `${Math.round(availableKB / 1024)}MB`,
            required: '100MB',
          },
        } as AppError;
      }
    } catch (error) {
      // 如果已经是我们抛出的错误，直接传播
      if ((error as AppError).code) {
        throw error;
      }
      // 其他错误（如命令执行失败）抛出 UNKNOWN_ERROR
      throw {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Failed to check disk space',
        cause: error as Error,
      } as AppError;
    }
  }

  async runAll(): Promise<void> {
    await this.checkDockerAvailable();
    await this.checkCredentials();
    await this.checkWorkspaceWritable();
    await this.checkDiskSpace();
  }
}

