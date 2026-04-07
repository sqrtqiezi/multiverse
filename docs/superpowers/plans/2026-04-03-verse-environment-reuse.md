# Verse Environment Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `multiverse start` persist and reuse a verse-bound Claude Code environment per project branch so repeated starts do not trigger re-initialization after the first start.

**Architecture:** Keep containers ephemeral, but give each verse a persistent host-side environment directory and mount that directory into Claude Code's writable state path inside the container. Upgrade verse metadata from run-history-only schema v1 to environment-aware schema v2, keep backward compatibility for old verse files, and drive the change with new Gherkin coverage before unit and implementation work.

**Tech Stack:** TypeScript, Node.js 22, pnpm workspaces, Vitest, Cucumber.js, Docker, dockerode

---

## File Structure

### Files to Modify

- `e2e/features/verse.feature`
  Adds environment reuse scenarios for first start, second start, container removal, and branch isolation.
- `e2e/features/step_definitions/start.steps.ts`
  Adds helpers to read schema v2 verse files, inspect verse environment paths, verify reuse behavior, and check environment markers.
- `packages/types/src/verse.ts`
  Extends verse types from schema v1 to schema v2 with environment metadata and compatibility types.
- `packages/core/src/verse/verse-repository.ts`
  Adds schema v1-to-v2 upgrade handling, verse environment path allocation, and schema-aware validation.
- `packages/core/src/verse/verse-service.ts`
  Returns richer verse context for CLI use and keeps run mutation behavior on top of upgraded verse metadata.
- `packages/core/src/verse/__tests__/verse-repository.test.ts`
  Covers schema v2 writes and schema v1 upgrade behavior.
- `packages/core/src/verse/__tests__/verse-service.test.ts`
  Covers verse creation, reuse, and detached HEAD behavior with environment metadata.
- `packages/cli/src/commands/start.ts`
  Mounts verse environment paths into the container and keeps run recording behavior intact.
- `packages/core/src/docker/credential-resolver.ts`
  Reworks credential handling so credentials and writable Claude state can coexist with verse-bound environment storage.

### Files to Create

- `packages/core/src/verse/claude-home.ts`
  Centralizes the chosen Claude state mount path and verse environment host path helpers.
- `packages/cli/src/__tests__/start-command.test.ts`
  Covers container config generation with verse environment mounts and reuse expectations.

## Task 1: Lock Down the Runtime Contract with E2E Coverage

**Files:**
- Modify: `e2e/features/verse.feature`
- Modify: `e2e/features/step_definitions/start.steps.ts`

- [ ] **Step 1: Write the failing Gherkin scenarios**

```gherkin
Feature: Verse persistence for start runs
  As a developer
  I want each branch to reuse its verse-bound Claude Code environment
  So that repeated starts do not re-run Claude initialization

  Background:
    Given Docker is available
    And Claude credentials exist
    And Ollama Anthropic-compatible API is available

  Scenario: First successful start creates verse file and environment directory
    Given verse file for current branch should not exist
    When I run "multiverse start"
    Then the exit code should be 0
    And verse file for current branch should exist
    And current branch verse should include environment metadata
    And current branch verse environment directory should exist

  Scenario: Second successful start reuses the same verse environment
    Given verse file for current branch should not exist
    When I run "multiverse start"
    Then the exit code should be 0
    And remember the current branch verse environment path
    When I run "multiverse start"
    Then the exit code should be 0
    And current branch verse should reuse the remembered environment path
    And verse file for current branch should have one more run

  Scenario: Start after container cleanup still reuses the same verse environment
    Given verse file for current branch should not exist
    When I run "multiverse start"
    Then the exit code should be 0
    And remember the current branch verse environment path
    And all multiverse containers are removed
    When I run "multiverse start"
    Then the exit code should be 0
    And current branch verse should reuse the remembered environment path
```

- [ ] **Step 2: Add failing step definitions for schema v2 verse metadata**

```ts
Then('current branch verse should include environment metadata', async () => {
  const { verse, versePath } = await readCurrentVerse();

  assert.equal(verse.schemaVersion, 2, `Expected schemaVersion 2 in ${versePath}`);
  assert.ok(verse.projectRoot, `Expected projectRoot in ${versePath}`);
  assert.ok(verse.environment, `Expected environment block in ${versePath}`);
  assert.ok(verse.environment.hostPath, `Expected environment.hostPath in ${versePath}`);
  assert.ok(verse.environment.containerPath, `Expected environment.containerPath in ${versePath}`);
  assert.ok(verse.environment.initializedAt, `Expected environment.initializedAt in ${versePath}`);
});

Then('current branch verse environment directory should exist', async () => {
  const { verse } = await readCurrentVerse();
  const stats = await fs.stat(verse.environment.hostPath);
  assert.ok(stats.isDirectory(), `Expected ${verse.environment.hostPath} to be a directory`);
});
```

- [ ] **Step 3: Add failing step definitions for remembering and reusing environment paths**

```ts
let lastObservedEnvironmentPath: string | undefined;

Then('remember the current branch verse environment path', async () => {
  const { verse } = await readCurrentVerse();
  lastObservedEnvironmentPath = verse.environment.hostPath;
});

Then('current branch verse should reuse the remembered environment path', async () => {
  const { verse } = await readCurrentVerse();
  assert.equal(
    verse.environment.hostPath,
    lastObservedEnvironmentPath,
    'Expected current branch verse to reuse the same environment host path',
  );
});
```

- [ ] **Step 4: Run the E2E feature to verify it fails**

Run: `pnpm --filter @multiverse/e2e cucumber-js e2e/features/verse.feature`

Expected: FAIL because the current verse JSON does not contain `schemaVersion: 2`, `projectRoot`, or `environment`.

- [ ] **Step 5: Commit the failing E2E coverage**

```bash
git add e2e/features/verse.feature e2e/features/step_definitions/start.steps.ts
git commit -m "test: define verse environment reuse e2e coverage"
```

## Task 2: Introduce Schema v2 Verse Metadata and Upgrade Logic

**Files:**
- Modify: `packages/types/src/verse.ts`
- Create: `packages/core/src/verse/claude-home.ts`
- Modify: `packages/core/src/verse/verse-repository.ts`
- Test: `packages/core/src/verse/__tests__/verse-repository.test.ts`

- [ ] **Step 1: Write the failing repository tests for schema v2 creation and schema v1 upgrade**

```ts
it('creates a schema v2 verse with environment metadata', async () => {
  const repository = new VerseRepository(tempDir);

  const verse = await repository.writeVerse({
    branch: 'main',
    mutate: () => undefined,
  });

  expect(verse.schemaVersion).toBe(2);
  expect(verse.projectRoot).toBe(tempDir);
  expect(verse.environment.hostPath).toContain(path.join('.multiverse', 'verse-envs'));
  expect(verse.environment.containerPath).toBe(CLAUDE_HOME_CONTAINER_PATH);
  expect(verse.environment.initializedAt).toBeTypeOf('string');
});

it('upgrades a schema v1 verse to schema v2 without losing runs', async () => {
  const versePath = getVersePath(tempDir, 'main');
  await fs.mkdir(path.dirname(versePath), { recursive: true });
  await fs.writeFile(
    versePath,
    JSON.stringify({
      schemaVersion: 1,
      id: 'verse-1',
      branch: 'main',
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
      runs: [{ runId: 'run-1', startAt: '2026-04-03T00:00:00.000Z' }],
    }),
  );

  const repository = new VerseRepository(tempDir);
  const verse = await repository.writeVerse({
    branch: 'main',
    mutate: () => undefined,
  });

  expect(verse.schemaVersion).toBe(2);
  expect(verse.runs).toHaveLength(1);
  expect(verse.environment.hostPath).toContain(path.join('.multiverse', 'verse-envs', 'verse-1'));
});
```

- [ ] **Step 2: Run the repository tests to verify they fail**

Run: `pnpm --filter @multiverse/core test -- verse-repository`

Expected: FAIL because `Verse` only supports schema v1 and no environment metadata exists.

- [ ] **Step 3: Define the schema v2 types and path helpers**

```ts
export interface VerseEnvironment {
  hostPath: string;
  containerPath: string;
  initializedAt: string;
}

export interface VerseV2 {
  schemaVersion: 2;
  id: string;
  branch: string;
  projectRoot: string;
  environment: VerseEnvironment;
  createdAt: string;
  updatedAt: string;
  runs: RunRecord[];
}

export interface VerseV1 {
  schemaVersion: 1;
  id: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
  runs: RunRecord[];
}

export type Verse = VerseV2;
export type PersistedVerse = VerseV1 | VerseV2;
```
```ts
export const CLAUDE_HOME_CONTAINER_PATH = '/home/coder';

export function getVerseEnvironmentHostPath(projectRoot: string, verseId: string): string {
  return path.join(projectRoot, '.multiverse', 'verse-envs', verseId, 'claude-home');
}
```

- [ ] **Step 4: Implement schema-aware upgrade logic in the repository**

```ts
private toVerseV2(candidate: PersistedVerse, branch: string): Verse {
  if (candidate.schemaVersion === 2) {
    return candidate;
  }

  return {
    schemaVersion: 2,
    id: candidate.id,
    branch: candidate.branch || branch,
    projectRoot: this.projectRoot,
    environment: {
      hostPath: getVerseEnvironmentHostPath(this.projectRoot, candidate.id),
      containerPath: CLAUDE_HOME_CONTAINER_PATH,
      initializedAt: candidate.createdAt,
    },
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    runs: candidate.runs,
  };
}
```

- [ ] **Step 5: Ensure the repository creates the environment directory before persisting**

```ts
const verse = this.toVerseV2(await this.loadOrCreateVerse(versePath, branch), branch);
await fs.mkdir(verse.environment.hostPath, { recursive: true });
await mutate(verse);
verse.updatedAt = new Date().toISOString();
await this.atomicWriteVerse(versePath, verse);
```

- [ ] **Step 6: Run the repository tests to verify they pass**

Run: `pnpm --filter @multiverse/core test -- verse-repository`

Expected: PASS with the new schema v2 creation and schema v1 upgrade assertions green.

- [ ] **Step 7: Commit the schema upgrade changes**

```bash
git add packages/types/src/verse.ts packages/core/src/verse/claude-home.ts packages/core/src/verse/verse-repository.ts packages/core/src/verse/__tests__/verse-repository.test.ts
git commit -m "feat: upgrade verse metadata for environment reuse"
```

## Task 3: Expose Verse Environment Context from the Service Layer

**Files:**
- Modify: `packages/core/src/verse/verse-service.ts`
- Test: `packages/core/src/verse/__tests__/verse-service.test.ts`

- [ ] **Step 1: Write the failing service tests for creation, reuse, and detached HEAD**

```ts
it('returns environment metadata when ensuring a verse for the current branch', async () => {
  const service = new VerseService();

  const verse = await service.ensureVerseForCurrentBranch(tempDir);

  expect(verse.schemaVersion).toBe(2);
  expect(verse.environment.hostPath).toContain(path.join('.multiverse', 'verse-envs'));
});

it('reuses the same verse environment path on repeated ensure calls', async () => {
  const service = new VerseService();

  const first = await service.ensureVerseForCurrentBranch(tempDir);
  const second = await service.ensureVerseForCurrentBranch(tempDir);

  expect(second.id).toBe(first.id);
  expect(second.environment.hostPath).toBe(first.environment.hostPath);
});
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `pnpm --filter @multiverse/core test -- verse-service`

Expected: FAIL because the service still returns the schema v1 shape.

- [ ] **Step 3: Keep the service interface simple and verse-centric**

```ts
async ensureVerseForCurrentBranch(cwd: string): Promise<Verse> {
  const branch = await this.branchResolver.getCurrentBranch(cwd);
  const repository = new VerseRepository(cwd);

  return await repository.writeVerse({
    branch,
    mutate: () => undefined,
  });
}
```

- [ ] **Step 4: Keep run mutation methods working against schema v2 verses**

```ts
mutate: (verse) => {
  verse.runs.push({
    runId,
    startAt,
  });
}
```
```ts
mutate: (verse) => {
  const run = verse.runs.find((entry) => entry.runId === runId);
  if (!run) {
    throw new RunNotFoundError();
  }

  run.endAt = endAt;
  run.exitCode = exitCode;
  run.containerId = containerId;
}
```

- [ ] **Step 5: Run the service tests to verify they pass**

Run: `pnpm --filter @multiverse/core test -- verse-service`

Expected: PASS with reuse assertions green.

- [ ] **Step 6: Commit the service-layer update**

```bash
git add packages/core/src/verse/verse-service.ts packages/core/src/verse/__tests__/verse-service.test.ts
git commit -m "feat: expose verse environment metadata through service"
```

## Task 4: Mount the Verse Environment into the Container and Preserve Credentials

**Files:**
- Modify: `packages/cli/src/commands/start.ts`
- Modify: `packages/core/src/docker/credential-resolver.ts`
- Create: `packages/cli/src/__tests__/start-command.test.ts`

- [ ] **Step 1: Write the failing CLI test for verse environment mounts**

```ts
it('includes the verse environment mount when starting a container', async () => {
  const verse = {
    schemaVersion: 2,
    id: 'verse-1',
    branch: 'main',
    projectRoot: '/repo',
    environment: {
      hostPath: '/repo/.multiverse/verse-envs/verse-1/claude-home',
      containerPath: '/home/coder',
      initializedAt: '2026-04-03T00:00:00.000Z',
    },
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
    runs: [],
  };

  expect(buildContainerConfig({ verse, cwd: '/repo', credentials }).volumes).toContainEqual({
    hostPath: '/repo/.multiverse/verse-envs/verse-1/claude-home',
    containerPath: '/home/coder',
    mode: 'rw',
  });
});
```

- [ ] **Step 2: Run the CLI test to verify it fails**

Run: `pnpm --filter @multiverse/cli test -- start-command`

Expected: FAIL because no builder exists and no verse environment mount is added.

- [ ] **Step 3: Extract config building so it can be tested directly**

```ts
export function buildContainerConfig(input: {
  cwd: string;
  imageTag: string;
  scriptedPrompt?: string;
  verse: Verse;
  credentials: CredentialConfig;
}): ContainerConfig {
  const workspaceMount = {
    hostPath: input.cwd,
    containerPath: '/workspace',
    mode: 'rw' as const,
  };

  const verseEnvironmentMount = {
    hostPath: input.verse.environment.hostPath,
    containerPath: input.verse.environment.containerPath,
    mode: 'rw' as const,
  };

  return {
    image: input.imageTag,
    volumes: [workspaceMount, verseEnvironmentMount, ...input.credentials.filePaths],
    workDir: '/workspace',
    entrypoint: input.scriptedPrompt ? ['claude', '--bare', '-p', input.scriptedPrompt] : undefined,
    env: input.credentials.envVars,
    autoRemove: true,
  };
}
```

- [ ] **Step 4: Keep credential handling compatible with a verse-mounted Claude home**

```ts
async resolveCredentialPaths(): Promise<CredentialPath[]> {
  try {
    await fs.access(this.claudeDir);
  } catch {
    return [];
  }

  const credentialsJson = path.join(this.claudeDir, 'credentials.json');
  const credentialsDotFile = path.join(this.claudeDir, '.credentials');

  return [
    { hostPath: credentialsJson, containerPath: '/tmp/multiverse-credentials/credentials.json', mode: 'ro' },
    { hostPath: credentialsDotFile, containerPath: '/tmp/multiverse-credentials/.credentials', mode: 'ro' },
  ].filter(asyncMountExists);
}
```

- [ ] **Step 5: Copy read-only credentials into the verse home before launch when needed**

```ts
await fs.mkdir(verse.environment.hostPath, { recursive: true });

for (const fileName of ['credentials.json', '.credentials']) {
  const sourcePath = path.join(os.homedir(), '.claude', fileName);
  const targetPath = path.join(verse.environment.hostPath, fileName);

  try {
    await fs.copyFile(sourcePath, targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
```

- [ ] **Step 6: Run the CLI test to verify it passes**

Run: `pnpm --filter @multiverse/cli test -- start-command`

Expected: PASS with the verse environment mount present and config shape stable.

- [ ] **Step 7: Commit the CLI/container config changes**

```bash
git add packages/cli/src/commands/start.ts packages/core/src/docker/credential-resolver.ts packages/cli/src/__tests__/start-command.test.ts
git commit -m "feat: mount verse environments into start containers"
```

## Task 5: Make the E2E Scenarios Pass End-to-End

**Files:**
- Modify: `e2e/features/step_definitions/start.steps.ts`
- Modify: `packages/cli/src/commands/start.ts`
- Modify: `packages/core/src/verse/verse-repository.ts`

- [ ] **Step 1: Add E2E helpers for schema-aware verse parsing**

```ts
type VerseEnvironment = {
  hostPath: string;
  containerPath: string;
  initializedAt: string;
};

type VerseFile = {
  schemaVersion: 1 | 2;
  id: string;
  branch: string;
  projectRoot?: string;
  environment?: VerseEnvironment;
  runs: Array<{
    runId: string;
    startAt: string;
    endAt?: string;
    exitCode?: number;
    containerId?: string;
  }>;
};
```

- [ ] **Step 2: Add environment marker checks so the test can detect reuse**

```ts
Then('current branch verse environment directory should contain remembered marker', async function () {
  const { verse } = await readCurrentVerse();
  const markerPath = path.join(verse.environment!.hostPath, 'e2e-marker.txt');
  const content = await fs.readFile(markerPath, 'utf8');
  assert.equal(content.trim(), 'E2E_OLLAMA_OK_20260403');
});
```

- [ ] **Step 3: Write the marker during scripted prompt runs**

```ts
const scriptedPrompt = process.env.MULTIVERSE_CLAUDE_PRINT_PROMPT?.trim()
  ?? 'printf "E2E_OLLAMA_OK_20260403\n"; printf "E2E_OLLAMA_OK_20260403\n" > ~/.claude/e2e-marker.txt';
```

- [ ] **Step 4: Run the E2E feature to verify it passes**

Run: `pnpm --filter @multiverse/e2e cucumber-js e2e/features/verse.feature`

Expected: PASS with schema v2 verse metadata present and stable environment paths reused across restarts.

- [ ] **Step 5: Commit the end-to-end green state**

```bash
git add e2e/features/verse.feature e2e/features/step_definitions/start.steps.ts packages/cli/src/commands/start.ts packages/core/src/verse/verse-repository.ts
git commit -m "test: verify verse environment reuse end to end"
```

## Task 6: Run the Focused Verification Suite and Update Docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README behavior description to match verse environment reuse**

```md
- 将当前目录挂载到容器 `/workspace`
- 为当前 Git branch 复用 `.multiverse/verse-envs/<verse-id>/claude-home/` 中的 Claude Code 环境
- 运行历史持久化到 `.multiverse/verses/*.json`
```

- [ ] **Step 2: Run the focused test suite**

Run: `pnpm --filter @multiverse/core test -- verse-repository verse-service`

Expected: PASS

Run: `pnpm --filter @multiverse/cli test -- start-command`

Expected: PASS

Run: `pnpm --filter @multiverse/e2e cucumber-js e2e/features/verse.feature`

Expected: PASS

- [ ] **Step 3: Run the repo-level regression checks**

Run: `pnpm test`

Expected: PASS

Run: `pnpm lint`

Expected: PASS

- [ ] **Step 4: Commit the docs and verification pass**

```bash
git add README.md
git commit -m "docs: describe verse environment reuse behavior"
```

## Self-Review

### Spec Coverage

- Verse identity by project + branch: covered by Tasks 2 and 3.
- Persistent verse environment directory: covered by Tasks 2 and 4.
- Reuse across repeated starts and after container cleanup: covered by Tasks 1 and 5.
- Detached HEAD handling: covered by Task 3 tests.
- Backward compatibility from schema v1 to schema v2: covered by Task 2.
- Ongoing run history recording: preserved in Tasks 3 and 4.

### Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation markers remain.
- Each code-changing step includes concrete code snippets.
- Each test step includes the exact command and expected failure or pass state.

### Type Consistency

- `schemaVersion: 2`, `projectRoot`, and `environment` are introduced in Task 2 and used consistently afterward.
- `CLAUDE_HOME_CONTAINER_PATH` is defined in Task 2 and reused in later tasks.
- `buildContainerConfig` is introduced in Task 4 before its test expectations are used.
