import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialResolver } from '../credential-resolver.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('CredentialResolver', () => {
  let tempDir: string;
  let resolver: CredentialResolver;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-claude-'));
    resolver = new CredentialResolver(tempDir);
    originalEnv = { ...process.env };

    // Clear ANTHROPIC_* and CLAUDE_CODE_* env vars for clean test environment
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('ANTHROPIC_') || key.startsWith('CLAUDE_CODE_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('should return empty config when no credentials exist', async () => {
    const nonExistentDir = path.join(os.tmpdir(), 'non-existent-dir');
    const resolver = new CredentialResolver(nonExistentDir);

    const result = await resolver.resolveCredentials();
    expect(result.filePaths).toEqual([]);
    expect(result.envVars).toEqual({});
  });

  it('should find credentials.json', async () => {
    await fs.writeFile(path.join(tempDir, 'credentials.json'), '{}');

    const result = await resolver.resolveCredentialPaths();

    expect(result).toHaveLength(1);
    expect(result[0].hostPath).toContain('credentials.json');
    expect(result[0].containerPath).toBe('/home/coder/.claude/credentials.json');
    expect(result[0].mode).toBe('ro');
  });

  it('should find multiple credential files', async () => {
    await fs.writeFile(path.join(tempDir, 'credentials.json'), '{}');
    await fs.writeFile(path.join(tempDir, '.credentials'), '{}');

    const result = await resolver.resolveCredentialPaths();

    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should ignore non-credential files', async () => {
    await fs.writeFile(path.join(tempDir, 'credentials.json'), '{}');
    await fs.writeFile(path.join(tempDir, 'settings.json'), '{}');
    await fs.mkdir(path.join(tempDir, 'projects'));

    const result = await resolver.resolveCredentialPaths();

    expect(result).toHaveLength(1);
    expect(result[0].hostPath).toContain('credentials.json');
  });

  it('should resolve ANTHROPIC_API_KEY from environment', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    const result = await resolver.resolveEnvVars();

    expect(result.ANTHROPIC_API_KEY).toBe('sk-ant-test-key');
  });

  it('should resolve all ANTHROPIC_* environment variables', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.ANTHROPIC_BASE_URL = 'https://api.example.com';
    process.env.ANTHROPIC_LOG_LEVEL = 'debug';
    process.env.OTHER_VAR = 'should-not-be-included';

    const result = await resolver.resolveEnvVars();

    expect(result.ANTHROPIC_API_KEY).toBe('sk-ant-test-key');
    expect(result.ANTHROPIC_BASE_URL).toBe('https://api.example.com');
    expect(result.ANTHROPIC_LOG_LEVEL).toBe('debug');
    expect(result.OTHER_VAR).toBeUndefined();
  });

  it('should resolve all CLAUDE_CODE_* environment variables', async () => {
    process.env.CLAUDE_CODE_API_KEY = 'test-key';
    process.env.CLAUDE_CODE_DEBUG = 'true';
    process.env.OTHER_VAR = 'should-not-be-included';

    const result = await resolver.resolveEnvVars();

    expect(result.CLAUDE_CODE_API_KEY).toBe('test-key');
    expect(result.CLAUDE_CODE_DEBUG).toBe('true');
    expect(result.OTHER_VAR).toBeUndefined();
  });

  it('should resolve both ANTHROPIC_* and CLAUDE_CODE_* variables', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.CLAUDE_CODE_DEBUG = 'true';

    const result = await resolver.resolveEnvVars();

    expect(result.ANTHROPIC_API_KEY).toBe('sk-ant-test-key');
    expect(result.CLAUDE_CODE_DEBUG).toBe('true');
  });

  it('should resolve both file and env credentials', async () => {
    await fs.writeFile(path.join(tempDir, 'credentials.json'), '{}');
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    const result = await resolver.resolveCredentials();

    expect(result.filePaths).toHaveLength(1);
    expect(result.envVars.ANTHROPIC_API_KEY).toBe('sk-ant-test-key');
  });
});
