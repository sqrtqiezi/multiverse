import type { AgentConfig } from '@multiverse/types';

export function greet(): string {
  return 'Hello from @multiverse/core';
}

export type { AgentConfig };

// Export Docker modules
export { DockerClient } from './docker/docker-client.js';
export { ImageBuilder } from './docker/image-builder.js';
export { CredentialResolver } from './docker/credential-resolver.js';
export { ContainerManager } from './docker/container-manager.js';
