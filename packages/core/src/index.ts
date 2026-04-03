import type { AgentConfig } from '@multiverse/types';

export function greet(): string {
  return 'Hello from @multiverse/core';
}

export { ContainerManager } from './docker/container-manager.js';
export { CredentialResolver } from './docker/credential-resolver.js';
// Export Docker modules
export { DockerClient } from './docker/docker-client.js';
export { ImageBuilder } from './docker/image-builder.js';
export { BranchResolver } from './git/branch-resolver.js';
export {
  getVersePath,
  getVersesDir,
  sanitizeBranchName,
  toVerseFileName,
} from './verse/verse-path.js';
export { VerseRepository } from './verse/verse-repository.js';
export { VerseService } from './verse/verse-service.js';
export type { AgentConfig };
