import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContainerManager, CredentialResolver, DockerClient, ImageBuilder } from '@multiverse/core';
import type { ContainerConfig } from '@multiverse/types';
import type { Container } from 'dockerode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;

  for (;;) {
    const workspaceFile = path.join(currentDir, 'pnpm-workspace.yaml');
    if (fs.existsSync(workspaceFile)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error('Failed to locate workspace root (pnpm-workspace.yaml not found).');
    }

    currentDir = parentDir;
  }
}

export async function startCommand(): Promise<void> {
  console.log('🚀 Starting multiverse...\n');

  // Step 1: Check Docker availability
  const dockerClient = new DockerClient();
  const availability = await dockerClient.checkAvailability();

  if (!availability.available) {
    console.error('❌ Docker is not available.\n');
    console.error('Please install Docker:');
    console.error('  - Linux: https://docs.docker.com/engine/install/');
    console.error('  - macOS: https://docs.docker.com/desktop/install/mac-install/');
    console.error('  - Windows: https://docs.docker.com/desktop/install/windows-install/\n');
    console.error('After installation, run: multiverse start');
    process.exit(1);
  }

  console.log(`✓ Docker ${availability.version} detected\n`);

  // Step 2: Ensure image exists
  const imageTag = 'multiverse/claude-code:latest';
  const workspaceRoot = findWorkspaceRoot(__dirname);
  const dockerfilePath = path.join(workspaceRoot, 'packages/core/docker/Dockerfile');

  const imageBuilder = new ImageBuilder(dockerClient);
  await imageBuilder.ensureImage(imageTag, dockerfilePath);
  console.log(`✓ Image ${imageTag} ready\n`);

  // Step 3: Resolve credentials
  const credentialResolver = new CredentialResolver();
  const credentials = await credentialResolver.resolveCredentials();

  if (credentials.filePaths.length === 0 && Object.keys(credentials.envVars).length === 0) {
    console.error('❌ Claude credentials not found.\n');
    console.error('Please authenticate using one of these methods:\n');
    console.error('1. File-based credentials:');
    console.error('   claude login\n');
    console.error('2. Environment variable:');
    console.error('   export ANTHROPIC_API_KEY=sk-ant-...\n');
    console.error('Then run: multiverse start');
    process.exit(1);
  }

  if (credentials.filePaths.length > 0) {
    console.log(`✓ Found ${credentials.filePaths.length} credential file(s)`);
  }
  if (Object.keys(credentials.envVars).length > 0) {
    console.log(`✓ Found ${Object.keys(credentials.envVars).length} credential env var(s)`);
  }
  console.log();

  // Step 4: Create container config
  const workspaceMount = {
    hostPath: process.cwd(),
    containerPath: '/workspace',
    mode: 'rw' as const,
  };

  const config: ContainerConfig = {
    image: imageTag,
    volumes: [workspaceMount, ...credentials.filePaths],
    workDir: '/workspace',
    env: credentials.envVars,
    autoRemove: true,
  };

  // Step 5: Create and start container
  const containerManager = new ContainerManager(dockerClient);

  let container: Container | undefined;
  try {
    container = await containerManager.createAndStart(config);
    console.log('✓ Container started\n');
    console.log('Entering claude-code interactive mode...\n');
    console.log('─'.repeat(50));
    console.log();

    // Step 6: Attach to container
    await containerManager.attach(container);

    // Step 7: Wait for exit
    const exitCode = await containerManager.waitForExit(container);

    console.log();
    console.log('─'.repeat(50));
    console.log(`\n✓ Container exited with code ${exitCode}`);

    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Failed to start container:', error);

    if (container) {
      await containerManager.remove(container);
    }

    process.exit(1);
  }
}
