# PR #2 Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all Critical and Important issues found in PR #2 code review.

**Architecture:** Targeted fixes across core, cli, and e2e packages — no structural changes.

**Tech Stack:** TypeScript, Vitest, Cucumber.js/Gherkin

---

### Task 1: Fix lint errors — merge duplicate exports in core/index.ts

**Files:**
- Modify: `packages/core/src/index.ts:8-9`

**Step 1: Run lint to capture current errors**

Run: `pnpm lint 2>&1 | head -40`
Expected: Errors including "import can be combined" for credential-resolver exports

**Step 2: Fix the duplicate export**

Merge lines 8-9 from:
```ts
export { CredentialResolver } from './docker/credential-resolver.js';
export { ORIGINAL_ANTHROPIC_BASE_URL_ENV } from './docker/credential-resolver.js';
```
To:
```ts
export { CredentialResolver, ORIGINAL_ANTHROPIC_BASE_URL_ENV } from './docker/credential-resolver.js';
```

**Step 3: Run lint again and fix any remaining errors**

Run: `pnpm lint`
Expected: All errors resolved (warnings acceptable if pre-existing)

**Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "fix: merge duplicate exports in core index to pass lint"
```

---

### Task 2: Replace hardcoded `/home/coder` with CLAUDE_HOME_CONTAINER_PATH constant

**Files:**
- Modify: `packages/cli/src/commands/start.ts:162`
- Modify: `packages/cli/src/__tests__/start-command.test.ts`

**Step 1: Write a failing test**

In `packages/cli/src/__tests__/start-command.test.ts`, add a test that verifies `syncCredentialFilesIntoVerseHome` skips credential files whose `containerPath` is outside the container home:

```ts
it('skips credential files with containerPath outside the container home', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multiverse-start-command-'));
  tempDirs.push(tempDir);

  const verseHomePath = path.join(tempDir, 'verse-home');
  await fs.mkdir(verseHomePath, { recursive: true });

  const sourcePath = path.join(tempDir, 'secret');
  await fs.writeFile(sourcePath, 'secret-data', 'utf8');

  await syncCredentialFilesIntoVerseHome(verseHomePath, {
    filePaths: [
      {
        hostPath: sourcePath,
        containerPath: '/etc/passwd',
        mode: 'ro',
      },
    ],
    envVars: {},
  });

  const files = await fs.readdir(verseHomePath);
  expect(files).toHaveLength(0);
});
```

**Step 2: Run test to verify it passes (existing behavior already handles this)**

Run: `pnpm --filter @multiverse/cli test -- --run`
Expected: PASS — the existing `path.relative` logic already skips paths outside `/home/coder`

**Step 3: Replace hardcoded path with constant**

In `packages/cli/src/commands/start.ts`, add import and replace:

```ts
// Add to imports from @multiverse/core:
import { CLAUDE_HOME_CONTAINER_PATH } from '@multiverse/core';

// Line 162: replace '/home/coder' with the constant
const relativeTargetPath = path.relative(CLAUDE_HOME_CONTAINER_PATH, credentialFile.containerPath);
```

Note: `CLAUDE_HOME_CONTAINER_PATH` is already exported from `@multiverse/core` via `packages/core/src/verse/claude-home.ts`. But it's NOT re-exported from `packages/core/src/index.ts` yet. Add the re-export:

In `packages/core/src/index.ts`, add:
```ts
export { CLAUDE_HOME_CONTAINER_PATH } from './verse/claude-home.js';
```

**Step 4: Run tests to verify nothing broke**

Run: `pnpm --filter @multiverse/cli test -- --run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/cli/src/commands/start.ts packages/cli/src/__tests__/start-command.test.ts
git commit -m "fix: replace hardcoded container path with CLAUDE_HOME_CONTAINER_PATH constant"
```

---

### Task 3: Fix 0o777 permissions to 0o755

**Files:**
- Modify: `packages/core/src/verse/verse-repository.ts:36,38`
- Modify: `packages/core/src/verse/__tests__/verse-repository.test.ts`

**Step 1: Check existing tests for permission assertions**

Run: `grep -n '0o777\|chmod\|permission' packages/core/src/verse/__tests__/verse-repository.test.ts`

**Step 2: Add a test that verifies directory permissions are 0o755**

If no existing test covers permissions, add one. If there is one asserting 0o777, update it to expect 0o755.

**Step 3: Change permissions from 0o777 to 0o755**

In `packages/core/src/verse/verse-repository.ts`, lines 36 and 38:
```ts
await fs.chmod(verse.environment.hostPath, 0o755);
// ...
await fs.chmod(path.join(verse.environment.hostPath, '.claude'), 0o755);
```

**Step 4: Run tests**

Run: `pnpm --filter @multiverse/core test -- --run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/core/src/verse/verse-repository.ts packages/core/src/verse/__tests__/verse-repository.test.ts
git commit -m "fix: tighten verse environment directory permissions from 0o777 to 0o755"
```

---

### Task 4: Fix run record timing — move appendRunStart before createAndStart

**Files:**
- Modify: `packages/cli/src/commands/start.ts`

**Step 1: Refactor scripted mode to record run start before container launch**

Move `appendRunStart` call to before `createAndStart` for both scripted and interactive modes. The unified flow:

```ts
// Record run start BEFORE container launch (both modes)
await verseService.appendRunStart({
  cwd: process.cwd(),
  runId,
  startAt: startedAt,
});
runStarted = true;

if (scriptedPrompt) {
  container = await containerManager.createAndStart(config);
  console.log('✓ Container started\n');
  console.log('Running claude-code scripted prompt mode...\n');
  console.log('─'.repeat(50));
  console.log();
} else {
  container = await containerManager.createAndStart(config);
  console.log('✓ Container started\n');
  console.log('Preparing claude-code interactive mode...\n');
  console.log('─'.repeat(50));
  console.log();
  await containerManager.attach(container);
}

// Remove the separate scripted appendRunStart block (lines 320-327)
```

**Step 2: Run tests**

Run: `pnpm --filter @multiverse/cli test -- --run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/cli/src/commands/start.ts
git commit -m "fix: record run start before container launch for accurate timestamps"
```

---

### Task 5: Extract scripted/interactive execution strategies

**Files:**
- Modify: `packages/cli/src/commands/start.ts`

**Step 1: Extract two helper functions**

Extract the branching logic into two clear functions within `start.ts`:

```ts
async function runScripted(
  container: Container,
  containerManager: ContainerManager,
): Promise<number> {
  const exitCode = await containerManager.waitForExit(container);
  const logs = await containerManager.logs(container);
  if (logs.length > 0) {
    process.stdout.write(logs);
    if (!logs.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
  return exitCode;
}

async function runInteractive(
  container: Container,
  containerManager: ContainerManager,
): Promise<number> {
  await containerManager.attach(container);
  return containerManager.waitForExit(container);
}
```

Then simplify `startCommand` to use them:

```ts
// Launch container
container = await containerManager.createAndStart(config);
console.log('✓ Container started\n');

if (scriptedPrompt) {
  console.log('Running claude-code scripted prompt mode...\n');
} else {
  console.log('Preparing claude-code interactive mode...\n');
}
console.log('─'.repeat(50));
console.log();

if (!scriptedPrompt) {
  await containerManager.attach(container);
}

const exitCode = scriptedPrompt
  ? await runScripted(container, containerManager)
  : await runInteractive(container, containerManager);
```

Wait — `runInteractive` already called `attach` above, so adjust: move `attach` into `runInteractive`, or keep it outside. Since Task 4 already unified the pre-launch flow, the simplest approach is:

```ts
container = await containerManager.createAndStart(config);
console.log('✓ Container started\n');
console.log(scriptedPrompt ? 'Running claude-code scripted prompt mode...\n' : 'Preparing claude-code interactive mode...\n');
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
```

This eliminates the 3-4 scattered `if (scriptedPrompt)` blocks into one clean branch.

**Step 2: Run tests**

Run: `pnpm --filter @multiverse/cli test -- --run && pnpm lint`
Expected: All tests PASS, lint clean

**Step 3: Commit**

```bash
git add packages/cli/src/commands/start.ts
git commit -m "refactor: consolidate scripted/interactive container execution branches"
```

---

### Task 6: Add timeout and limits to Anthropic Base URL proxy

**Files:**
- Modify: `packages/cli/src/commands/start.ts` (startAnthropicBaseUrlProxy function)

**Step 1: Add timeout and connection limits**

```ts
const server = createServer((req, res) => {
  // Add request timeout
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
    // ... rest unchanged
  );

  upstream.on('timeout', () => {
    upstream.destroy();
    res.statusCode = 504;
    res.end('proxy upstream timeout');
  });

  // ... rest unchanged
});

server.maxConnections = 50;
```

**Step 2: Run tests**

Run: `pnpm --filter @multiverse/cli test -- --run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/cli/src/commands/start.ts
git commit -m "fix: add timeout and connection limits to anthropic base url proxy"
```

---

### Task 7: Update design doc to match implementation

**Files:**
- Modify: `docs/plans/2026-04-03-verse-environment-reuse-design.md` (or similar filename)

**Step 1: Find the design doc**

Run: `ls docs/plans/*verse*`

**Step 2: Update CLAUDE_HOME_CONTAINER_PATH reference**

Change any reference from `/home/coder/.claude` to `/home/coder` to match the actual implementation in `claude-home.ts`.

**Step 3: Commit**

```bash
git add docs/plans/
git commit -m "docs: sync verse environment reuse design with implementation"
```

---

### Task 8: Restore run finalization verification in e2e tests

**Files:**
- Modify: `e2e/features/verse.feature`
- Modify: `e2e/features/step_definitions/start.steps.ts` (if step not already defined)

**Step 1: Add run finalization assertion to existing scenario**

Append to the "Second successful start reuses the same verse environment" scenario:

```gherkin
    And latest run in current branch verse should contain finish fields
```

**Step 2: Verify the step definition exists**

Run: `grep -n 'finish fields\|endAt.*exitCode.*containerId' e2e/features/step_definitions/start.steps.ts`

If the step definition was removed, re-add it:

```ts
Then('latest run in current branch verse should contain finish fields', async function () {
  const versePath = getVersePath(this.tempProjectDir, this.currentBranch);
  const raw = JSON.parse(await fs.readFile(versePath, 'utf8'));
  const latestRun = raw.runs[raw.runs.length - 1];
  expect(latestRun.endAt).toBeDefined();
  expect(latestRun.exitCode).toBeDefined();
  expect(latestRun.containerId).toBeDefined();
});
```

**Step 3: Commit**

```bash
git add e2e/features/verse.feature e2e/features/step_definitions/start.steps.ts
git commit -m "test: restore run finalization verification in e2e verse scenarios"
```
