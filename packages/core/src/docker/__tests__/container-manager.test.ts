import type { ContainerConfig } from '@multiverse/types';
import { describe, expect, it, vi } from 'vitest';
import { ContainerManager } from '../container-manager.js';

describe('ContainerManager', () => {
  it('should create container config', () => {
    const dockerClient = {
      getDocker: () => ({ createContainer: vi.fn() }),
    } as any;
    const manager = new ContainerManager(dockerClient);

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
});
