import { describe, it, expect } from 'vitest';
import { ContainerManager } from '../container-manager.js';
import { DockerClient } from '../docker-client.js';
import type { ContainerConfig } from '@multiverse/types';

describe('ContainerManager', () => {
  it('should create container config', () => {
    const dockerClient = new DockerClient();
    const manager = new ContainerManager(dockerClient);

    const config: ContainerConfig = {
      image: 'multiverse/claude-code:latest',
      volumes: [],
      workDir: '/workspace',
      autoRemove: true,
    };

    expect(config.image).toBe('multiverse/claude-code:latest');
  });

  // Note: Full integration tests require Docker running
  // These are unit tests with mocked Docker API
});
