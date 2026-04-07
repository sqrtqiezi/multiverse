import type { AgentConfig } from '@multiverse/types';

export function greet(): string {
  return 'Hello from @multiverse/core';
}

export { ContainerManager } from './docker/container-manager.js';
export {
  CredentialResolver,
  ORIGINAL_ANTHROPIC_BASE_URL_ENV,
} from './docker/credential-resolver.js';
// Export Docker modules
export { DockerClient } from './docker/docker-client.js';
export { ImageBuilder } from './docker/image-builder.js';
// Export error handling modules
export { ErrorCode } from './error-handler/error-codes.js';
export { ErrorHandler } from './error-handler/error-handler.js';
export { ERROR_TEMPLATES } from './error-handler/error-templates.js';
export type { AppError, ErrorTemplate, FormattedError } from './error-handler/types.js';
export { BranchResolver } from './git/branch-resolver.js';
// Export preflight checks
export { PreflightChecker } from './preflight/index.js';
export { CLAUDE_HOME_CONTAINER_PATH } from './verse/claude-home.js';
export {
  getVersePath,
  getVersesDir,
  sanitizeBranchName,
  toVerseFileName,
} from './verse/verse-path.js';
export { VerseRepository } from './verse/verse-repository.js';
export { VerseService } from './verse/verse-service.js';
export type { AgentConfig };
