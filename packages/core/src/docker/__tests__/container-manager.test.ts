import { PassThrough } from 'node:stream';
import type { ContainerConfig } from '@multiverse/types';
import { describe, expect, it, vi } from 'vitest';
import { ContainerManager } from '../container-manager.js';

describe('ContainerManager', () => {
  it('should create container config', () => {
    const dockerClient = {
      getDocker: () => ({ createContainer: vi.fn() }),
    } as any;
    const _manager = new ContainerManager(dockerClient);

    const config: ContainerConfig = {
      image: 'multiverse/claude-code:latest',
      volumes: [],
      workDir: '/workspace',
      autoRemove: true,
    };

    expect(config.image).toBe('multiverse/claude-code:latest');
  });

  it('should pass extra hosts to docker host config', async () => {
    const start = vi.fn();
    const createContainer = vi.fn().mockResolvedValue({ start });
    const dockerClient = {
      getDocker: () => ({ createContainer }),
    } as any;
    const manager = new ContainerManager(dockerClient);

    await manager.createAndStart({
      image: 'multiverse/claude-code:latest',
      volumes: [],
      workDir: '/workspace',
      extraHosts: ['host.docker.internal:host-gateway'],
    });

    expect(createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        HostConfig: expect.objectContaining({
          ExtraHosts: ['host.docker.internal:host-gateway'],
        }),
      }),
    );
    expect(start).toHaveBeenCalled();
  });

  it('creates interactive containers before starting them', async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const container = { start } as any;
    const createContainer = vi.fn().mockResolvedValue(container);
    const dockerClient = {
      getDocker: () => ({ createContainer }),
    } as any;
    const manager = new ContainerManager(dockerClient);

    const created = await manager.create({
      image: 'multiverse/claude-code:latest',
      volumes: [],
      workDir: '/workspace',
    });

    expect(created).toBe(container);
    expect(start).not.toHaveBeenCalled();

    await manager.start(container);

    expect(start).toHaveBeenCalled();
  });

  it('resizes the container immediately after attaching in interactive mode', async () => {
    const stream = new PassThrough();
    const resize = vi.fn().mockResolvedValue(undefined);
    const attach = vi.fn().mockResolvedValue(stream);
    const container = { attach, resize } as any;
    const dockerClient = { getDocker: vi.fn() } as any;
    const manager = new ContainerManager(dockerClient);

    const stdinSetRawMode = vi.fn();
    const originalStdinIsTTY = process.stdin.isTTY;
    const originalStdoutIsTTY = process.stdout.isTTY;
    const originalRows = process.stdout.rows;
    const originalColumns = process.stdout.columns;
    const originalSetRawMode = process.stdin.setRawMode;

    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'rows', { value: 40, configurable: true });
    Object.defineProperty(process.stdout, 'columns', { value: 120, configurable: true });
    Object.defineProperty(process.stdin, 'setRawMode', {
      value: stdinSetRawMode,
      configurable: true,
    });

    try {
      await manager.attach(container);

      expect(attach).toHaveBeenCalled();
      expect(resize).toHaveBeenCalledWith({ h: 40, w: 120 });
      expect(stdinSetRawMode).toHaveBeenCalledWith(true);
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalStdinIsTTY,
        configurable: true,
      });
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalStdoutIsTTY,
        configurable: true,
      });
      Object.defineProperty(process.stdout, 'rows', {
        value: originalRows,
        configurable: true,
      });
      Object.defineProperty(process.stdout, 'columns', {
        value: originalColumns,
        configurable: true,
      });
      Object.defineProperty(process.stdin, 'setRawMode', {
        value: originalSetRawMode,
        configurable: true,
      });
    }
  });
});
