/**
 * Multiverse shared type definitions.
 */
export interface AgentConfig {
  name: string;
  image: string;
  env?: Record<string, string>;
}
