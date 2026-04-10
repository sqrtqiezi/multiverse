import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { request as httpsRequest } from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import type { AppError } from '@multiverse/core';
import {
  CLAUDE_HOME_CONTAINER_PATH,
  ContainerManager,
  CredentialResolver,
  checkTemplateDrift,
  DockerClient,
  ErrorCode,
  ImageBuilder,
  injectTemplateSnapshot,
  ORIGINAL_ANTHROPIC_BASE_URL_ENV,
  PreflightChecker,
  TemplateService,
  VerseService,
} from '@multiverse/core';
import type { ContainerConfig, CredentialConfig, Verse } from '@multiverse/types';
import type { Container } from 'dockerode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface AnthropicBaseUrlProxy {
  baseUrl: string;
  server: Server;
}

type DriftAction = 'keep' | 'sync-and-switch' | 'cancel';

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

function usesHostDockerInternal(baseUrl?: string) {
  if (!baseUrl) {
    return false;
  }

  try {
    return new URL(baseUrl).hostname === 'host.docker.internal';
  } catch {
    return false;
  }
}

async function closeAnthropicBaseUrlProxy(proxy?: AnthropicBaseUrlProxy) {
  if (!proxy) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    proxy.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function promptForDriftAction({
  templateName,
  drift,
  input = process.stdin,
  output = process.stdout,
}: {
  templateName: string;
  drift: Awaited<ReturnType<typeof checkTemplateDrift>>;
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
}): Promise<DriftAction> {
  const rl = createInterface({ input, output });

  try {
    console.log(`Current global config has drifted from template "${templateName}".`);
    if (drift.addedFiles.length > 0) {
      console.log(`Added files: ${drift.addedFiles.join(', ')}`);
    }
    if (drift.modifiedFiles.length > 0) {
      console.log(`Modified files: ${drift.modifiedFiles.join(', ')}`);
    }
    if (drift.removedFiles.length > 0) {
      console.log(`Removed files: ${drift.removedFiles.join(', ')}`);
    }
    console.log('1) Keep current template');
    console.log('2) Sync and switch to a new template');
    console.log('3) Cancel start');

    for (;;) {
      const answer = (await rl.question('Choose an option [1-3]: ')).trim().toLowerCase();

      if (answer === '1' || answer === 'keep') {
        return 'keep';
      }
      if (answer === '2' || answer === 'sync-and-switch') {
        return 'sync-and-switch';
      }
      if (answer === '3' || answer === 'cancel') {
        return 'cancel';
      }

      console.log('Please enter 1, 2, or 3.');
    }
  } finally {
    rl.close();
  }
}

type StartCommandOptions = {
  template?: string;
  promptForDriftAction?: typeof promptForDriftAction;
};

async function startAnthropicBaseUrlProxy(
  containerBaseUrl: string,
  originalBaseUrl: string,
): Promise<AnthropicBaseUrlProxy> {
  const upstreamBaseUrl = new URL(originalBaseUrl);
  const requestImpl = upstreamBaseUrl.protocol === 'https:' ? httpsRequest : httpRequest;
  const server = createServer((req, res) => {
    req.setTimeout(30_000, () => {
      res.statusCode = 408;
      res.end('proxy request timeout');
    });

    const upstream = requestImpl(
      {
        hostname: upstreamBaseUrl.hostname,
        port: Number(upstreamBaseUrl.port || (upstreamBaseUrl.protocol === 'https:' ? 443 : 80)),
        path: req.url || '/',
        method: req.method,
        headers: req.headers,
        timeout: 30_000,
      },
      (upstreamResponse) => {
        res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(res);
      },
    );

    upstream.on('timeout', () => {
      upstream.destroy();
      res.statusCode = 504;
      res.end('proxy upstream timeout');
    });

    upstream.on('error', (error) => {
      res.statusCode = 502;
      res.end(`anthropic base url proxy upstream error: ${String(error)}`);
    });

    req.pipe(upstream);
  });

  server.maxConnections = 50;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine anthropic base url proxy port');
  }

  const proxiedBaseUrl = new URL(containerBaseUrl);
  proxiedBaseUrl.hostname = 'host.docker.internal';
  proxiedBaseUrl.port = String(address.port);

  return {
    baseUrl: proxiedBaseUrl.toString(),
    server,
  };
}

type BuildContainerConfigInput = {
  cwd: string;
  imageTag: string;
  scriptedPrompt?: string;
  verse: Verse;
  credentials: CredentialConfig;
  extraHosts?: string[];
};

function getContainerUser(): string | undefined {
  if (typeof process.getuid !== 'function' || typeof process.getgid !== 'function') {
    return undefined;
  }

  return `${process.getuid()}:${process.getgid()}`;
}

function getInteractiveTerminalEnv(): Record<string, string> {
  const term =
    process.env.TERM && process.env.TERM !== 'dumb' ? process.env.TERM : 'xterm-256color';
  const env: Record<string, string> = { TERM: term };

  if (process.env.COLORTERM) {
    env.COLORTERM = process.env.COLORTERM;
  }
  if (process.env.LANG) {
    env.LANG = process.env.LANG;
  }

  return env;
}

export async function syncCredentialFilesIntoVerseHome(
  verseHomePath: string,
  credentials: CredentialConfig,
): Promise<void> {
  for (const credentialFile of credentials.filePaths) {
    const relativeTargetPath = path.relative(
      CLAUDE_HOME_CONTAINER_PATH,
      credentialFile.containerPath,
    );

    if (
      relativeTargetPath.startsWith('..') ||
      path.isAbsolute(relativeTargetPath) ||
      relativeTargetPath.length === 0
    ) {
      continue;
    }

    const targetPath = path.join(verseHomePath, relativeTargetPath);
    await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
    await fsPromises.copyFile(credentialFile.hostPath, targetPath);
  }
}

export function buildContainerConfig({
  cwd,
  imageTag,
  scriptedPrompt,
  verse,
  credentials,
  extraHosts,
}: BuildContainerConfigInput): ContainerConfig {
  const isScriptedMode = Boolean(scriptedPrompt);
  const workspaceMount = {
    hostPath: cwd,
    containerPath: '/workspace',
    mode: 'rw' as const,
  };
  const verseEnvironmentMount = {
    hostPath: verse.environment.hostPath,
    containerPath: verse.environment.containerPath,
    mode: 'rw' as const,
  };

  return {
    image: imageTag,
    volumes: [workspaceMount, verseEnvironmentMount],
    workDir: '/workspace',
    entrypoint: scriptedPrompt ? ['bash', '-lc', scriptedPrompt] : undefined,
    env: {
      ...credentials.envVars,
      HOME: verse.environment.containerPath,
      ...(!isScriptedMode ? getInteractiveTerminalEnv() : {}),
    },
    user: getContainerUser(),
    tty: !isScriptedMode,
    extraHosts,
    autoRemove: !isScriptedMode,
  };
}

export async function startCommand(options: StartCommandOptions): Promise<void> {
  console.log('🚀 Starting multiverse...\n');
  const scriptedPrompt = process.env.MULTIVERSE_CLAUDE_PRINT_PROMPT?.trim();
  const resolveDriftAction = options.promptForDriftAction ?? promptForDriftAction;

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
  const originalAnthropicBaseUrl = credentials.envVars[ORIGINAL_ANTHROPIC_BASE_URL_ENV];
  delete credentials.envVars[ORIGINAL_ANTHROPIC_BASE_URL_ENV];

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

  let anthropicBaseUrlProxy: AnthropicBaseUrlProxy | undefined;
  if (credentials.envVars.ANTHROPIC_BASE_URL && originalAnthropicBaseUrl) {
    anthropicBaseUrlProxy = await startAnthropicBaseUrlProxy(
      credentials.envVars.ANTHROPIC_BASE_URL,
      originalAnthropicBaseUrl,
    );
    credentials.envVars.ANTHROPIC_BASE_URL = anthropicBaseUrlProxy.baseUrl;
    console.log('✓ Bridged local Anthropic base URL for container access');
    console.log();
  }

  const verseService = new VerseService();
  const templateName = options.template ?? 'default';
  const templatesDir = path.join(os.homedir(), '.multiverse', 'templates');
  const templateService = new TemplateService(templatesDir);
  const template = await templateService.findByName(templateName);
  if (!template) {
    console.error(`Template "${templateName}" not found`);
    console.error('\nHint: create one with `multiverse template create default`');
    process.exit(1);
  }

  let activeTemplate = template;
  let verse = await verseService.ensureVerseForCurrentBranch(process.cwd(), activeTemplate.id);

  // If the verse is already bound to a different template (e.g. from a previous sync-and-switch),
  // check drift against the verse's actual template instead of the named one.
  if (verse.templateId !== template.id) {
    const verseTemplate = await templateService.findById(verse.templateId);
    if (verseTemplate) {
      activeTemplate = verseTemplate;
    }
  }

  const drift = await checkTemplateDrift({
    homeDir: os.homedir(),
    template: activeTemplate,
  });

  if (drift.isDrifted) {
    const envDriftAction = process.env.MULTIVERSE_DRIFT_ACTION as DriftAction | undefined;
    const driftAction =
      envDriftAction ?? (await resolveDriftAction({ templateName: activeTemplate.name, drift }));

    if (driftAction === 'cancel') {
      console.log('Start cancelled');
      throw {
        code: ErrorCode.START_CANCELLED,
        message: 'Start cancelled',
      } as AppError;
    }

    if (driftAction === 'sync-and-switch') {
      const syncedTemplate = await templateService.createSyncedTemplate({
        baseTemplateName: template.name,
        homeDir: os.homedir(),
      });
      verse = await verseService.updateTemplateForCurrentBranch(process.cwd(), syncedTemplate.id);
      activeTemplate = syncedTemplate;
      console.log(`Created synced template "${syncedTemplate.name}"\n`);
    }
  }

  const activeVerse = verse;

  console.log(`✓ Verse ready for branch ${activeVerse.branch}\n`);

  await syncCredentialFilesIntoVerseHome(activeVerse.environment.hostPath, credentials);

  await injectTemplateSnapshot(activeVerse.environment.hostPath, activeTemplate.snapshot);
  console.log(`✓ Template "${activeTemplate.name}" configuration injected\n`);

  // Step 5: Create container config
  const config = buildContainerConfig({
    cwd: process.cwd(),
    imageTag,
    scriptedPrompt,
    verse: activeVerse,
    credentials,
    extraHosts:
      process.platform === 'linux' && usesHostDockerInternal(credentials.envVars.ANTHROPIC_BASE_URL)
        ? ['host.docker.internal:host-gateway']
        : undefined,
  });

  // Step 6: Create and start container
  const containerManager = new ContainerManager(dockerClient);

  let container: Container | undefined;
  let runStarted = false;
  let runFinalized = false;
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  try {
    // Record run start BEFORE container launch (both modes)
    await verseService.appendRunStart({
      cwd: process.cwd(),
      runId,
      startAt: startedAt,
      templateId: activeTemplate.id,
    });
    runStarted = true;

    container = await containerManager.createAndStart(config);
    console.log('✓ Container started\n');
    console.log(
      scriptedPrompt
        ? 'Running claude-code scripted prompt mode...\n'
        : 'Preparing claude-code interactive mode...\n',
    );
    console.log('─'.repeat(50));
    console.log();

    let exitCode: number;
    if (scriptedPrompt) {
      exitCode = await containerManager.waitForExit(container);
      const logs = await containerManager.logs(container);
      if (logs.length > 0) {
        process.stdout.write(logs);
        if (!logs.endsWith('\n')) {
          process.stdout.write('\n');
        }
      }
    } else {
      await containerManager.attach(container);
      exitCode = await containerManager.waitForExit(container);
    }

    await verseService.finalizeRun({
      cwd: process.cwd(),
      runId,
      endAt: new Date().toISOString(),
      exitCode,
      containerId: container.id,
      templateId: activeTemplate.id,
    });
    runFinalized = true;

    console.log();
    console.log('─'.repeat(50));
    console.log(`\n✓ Container exited with code ${exitCode}`);
    if (scriptedPrompt) {
      await containerManager.remove(container);
    }
    await closeAnthropicBaseUrlProxy(anthropicBaseUrlProxy);

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
          templateId: activeTemplate.id,
        });
      } catch (finalizeError) {
        console.error('Failed to finalize verse run:', finalizeError);
      }
    }

    if (container) {
      await containerManager.remove(container);
    }
    await closeAnthropicBaseUrlProxy(anthropicBaseUrlProxy);

    // Re-throw as AppError if not already one
    const validErrorCodes = Object.values(ErrorCode);
    if ((error as AppError).code && validErrorCodes.includes((error as AppError).code)) {
      throw error;
    }

    throw {
      code: ErrorCode.CONTAINER_START_FAILED,
      message: 'Failed to start container',
      cause: error instanceof Error ? error : new Error(String(error)),
    } as AppError;
  }
}
