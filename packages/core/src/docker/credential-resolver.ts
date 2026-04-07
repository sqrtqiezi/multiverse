import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CredentialConfig, CredentialPath } from '@multiverse/types';
import { CLAUDE_HOME_CONTAINER_PATH } from '../verse/claude-home.js';

const CREDENTIAL_FILES = ['credentials.json', '.credentials'];
export const ORIGINAL_ANTHROPIC_BASE_URL_ENV = 'MULTIVERSE_ORIGINAL_ANTHROPIC_BASE_URL';

function isLoopbackHost(hostname: string) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

function preserveBareOrigin(originalValue: string, renderedValue: string) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:\/\/[^/]+$/.test(originalValue)
    ? renderedValue.replace(/\/$/, '')
    : renderedValue;
}

function rewriteAnthropicBaseUrlForContainer(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    if (!isLoopbackHost(parsed.hostname)) {
      return { rewritten: baseUrl };
    }

    parsed.hostname = 'host.docker.internal';
    return {
      original: baseUrl,
      rewritten: preserveBareOrigin(baseUrl, parsed.toString()),
    };
  } catch {
    return { rewritten: baseUrl };
  }
}

export class CredentialResolver {
  private claudeDir: string;

  constructor(claudeDir?: string) {
    this.claudeDir = claudeDir || path.join(os.homedir(), '.claude');
  }

  async resolveCredentials(): Promise<CredentialConfig> {
    const filePaths = await this.resolveCredentialPaths();
    const envVars = await this.resolveEnvVars();

    return { filePaths, envVars };
  }

  async resolveCredentialPaths(): Promise<CredentialPath[]> {
    try {
      await fs.access(this.claudeDir);
    } catch {
      return [];
    }

    const files = await fs.readdir(this.claudeDir);
    const credentialPaths: CredentialPath[] = [];

    for (const file of files) {
      if (CREDENTIAL_FILES.includes(file)) {
        const hostPath = path.join(this.claudeDir, file);
        const containerPath = `${CLAUDE_HOME_CONTAINER_PATH}/${file}`;

        credentialPaths.push({
          hostPath,
          containerPath,
          mode: 'ro',
        });
      }
    }

    return credentialPaths;
  }

  async resolveEnvVars(): Promise<Record<string, string>> {
    const envVars: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if ((key.startsWith('ANTHROPIC_') || key.startsWith('CLAUDE_CODE_')) && value !== undefined) {
        if (key === 'ANTHROPIC_BASE_URL') {
          const { original, rewritten } = rewriteAnthropicBaseUrlForContainer(value);
          envVars[key] = rewritten;
          if (original) {
            envVars[ORIGINAL_ANTHROPIC_BASE_URL_ENV] = original;
          }
          continue;
        }

        envVars[key] = value;
      }
    }

    return envVars;
  }
}
