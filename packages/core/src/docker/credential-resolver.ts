import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { CredentialPath, CredentialConfig } from '@multiverse/types';

const CREDENTIAL_FILES = ['credentials.json', '.credentials'];

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
        const containerPath = `/home/coder/.claude/${file}`;

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
        envVars[key] = value;
      }
    }

    return envVars;
  }
}
