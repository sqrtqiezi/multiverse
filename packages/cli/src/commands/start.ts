import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppError } from '@multiverse/core';
import {
  ContainerManager,
  CredentialResolver,
  DockerClient,
  ErrorCode,
  ImageBuilder,
  PreflightChecker,
  VerseService,
} from '@multiverse/core';
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

  // Step 1: Run preflight checks (Docker, credentials, workspace, disk space)
  const preflightChecker = new PreflightChecker();
  await preflightChecker.runAll();
  console.log('✓ Preflight checks passed\n');

  // Step 2: Check Docker version for display
  const dockerClient = new DockerClient();
  const availability = await dockerClient.checkAvailability();
  if (availability.available) {
    console.log(`✓ Docker ${availability.version} detected\n`);
  }

  // Step 3: Ensure image exists
  const imageTag = 'multiverse/claude-code:latest';
  const workspaceRoot = findWorkspaceRoot(__dirname);
  const dockerfilePath = path.join(workspaceRoot, 'packages/core/docker/Dockerfile');

  const imageBuilder = new ImageBuilder(dockerClient);
  await imageBuilder.ensureImage(imageTag, dockerfilePath);
  console.log(`✓ Image ${imageTag} ready\n`);

  // Step 4: Resolve credentials
  const credentialResolver = new CredentialResolver();
  const credentials = await credentialResolver.resolveCredentials();

  if (credentials.filePaths.length === 0 && Object.keys(credentials.envVars).length === 0) {
    throw {
      code: ErrorCode.CREDENTIALS_NOT_FOUND,
      message: 'Claude credentials not found',
    } as AppError;
  }

  if (credentials.filePaths.length > 0) {
    console.log(`✓ Found ${credentials.filePaths.length} credential file(s)`);
  }
  if (Object.keys(credentials.envVars).length > 0) {
    console.log(`✓ Found ${Object.keys(credentials.envVars).length} credential env var(s)`);
  }
  console.log();

  const verseService = new VerseService();
  const verse = await verseService.ensureVerseForCurrentBranch(process.cwd());
  console.log(`✓ Verse ready for branch ${verse.branch}\n`);

  // Step 5: Create container config
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

  // Step 6: Create and start container
  const containerManager = new ContainerManager(dockerClient);

  let container: Container | undefined;
  let runStarted = false;
  let runFinalized = false;
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  try {
    container = await containerManager.createAndStart(config);
    await verseService.appendRunStart({
      cwd: process.cwd(),
      runId,
      startAt: startedAt,
    });
    runStarted = true;
    console.log('✓ Container started\n');
    console.log('Entering claude-code interactive mode...\n');
    console.log('─'.repeat(50));
    console.log();

    // Step 7: Attach to container
    await containerManager.attach(container);

    // Step 8: Wait for exit
    const exitCode = await containerManager.waitForExit(container);
    await verseService.finalizeRun({
      cwd: process.cwd(),
      runId,
      endAt: new Date().toISOString(),
      exitCode,
      containerId: container.id,
    });
    runFinalized = true;

    console.log();
    console.log('─'.repeat(50));
    console.log(`\n✓ Container exited with code ${exitCode}`);

    process.exit(exitCode);
  } catch (error) {
    if (runStarted && !runFinalized && container) {
      try {
        await verseService.finalizeRun({
          cwd: process.cwd(),
          runId,
          endAt: new Date().toISOString(),
          exitCode: 1,
          containerId: container.id,
        });
      } catch (finalizeError) {
        console.error('Failed to finalize verse run:', finalizeError);
      }
    }

    if (container) {
      await containerManager.remove(container);
    }

    // Re-throw as AppError if not already one
    const validErrorCodes = Object.values(ErrorCode);
    if (
      (error as AppError).code &&
      validErrorCodes.includes((error as AppError).code)
    ) {
      throw error;
    }

    throw {
      code: ErrorCode.CONTAINER_START_FAILED,
      message: 'Failed to start container',
      cause: error instanceof Error ? error : new Error(String(error)),
    } as AppError;
  }
}
