/**
 * Multiverse shared type definitions.
 */
export interface AgentConfig {
  name: string;
  image: string;
  env?: Record<string, string>;
}

export * from './docker.js';
export * from './verse.js';
export * from './template.js';
