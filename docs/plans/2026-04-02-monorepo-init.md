# Multiverse Monorepo 初始化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 初始化 Multiverse monorepo 仓库，搭建完整的项目骨架，使所有包可以构建、测试和 lint 通过。

**Architecture:** pnpm workspaces 管理 4 个包（types、core、cli、gui），Turborepo 编排构建任务。TS 包用 tsup 编译，GUI 前端用 Vite。Biome 统一 lint/format，Vitest 单元测试，Cucumber.js E2E 测试。

**Tech Stack:** Node.js 22+, TypeScript 5.x, pnpm, Turborepo, Tauri 2.x, React 19, Vite, tsup, Biome, Vitest, Cucumber.js

---

## 前置条件

- Node.js 22+ 已安装（已确认 v22.20.0）
- pnpm 已安装（已确认 9.4.0）
- Rust 工具链需要安装（Task 7 处理）

---

### Task 1: 根级配置 — pnpm workspace + package.json

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `.npmrc`
- Create: `.gitignore`

**Step 1: 创建 pnpm workspace 配置**

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

**Step 2: 创建根 package.json**

```json
{
  "name": "multiverse",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "packageManager": "pnpm@9.4.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "clean": "turbo run clean"
  }
}
```

**Step 3: 创建 .npmrc**

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

**Step 4: 创建 .gitignore**

```gitignore
node_modules/
dist/
.turbo/
*.tsbuildinfo
target/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Env
.env
.env.local
```

**Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json .npmrc .gitignore
git commit -m "chore: add root pnpm workspace and project config"
```

---

### Task 2: TypeScript 基础配置

**Files:**
- Create: `tsconfig.json`（根级基础配置）
- Create: `tsconfig.build.json`（构建用，带 project references）

**Step 1: 创建根 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2023"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false
  },
  "exclude": ["node_modules", "dist", "target"]
}
```

**Step 2: 创建 tsconfig.build.json**

```json
{
  "files": [],
  "references": [
    { "path": "packages/types" },
    { "path": "packages/core" },
    { "path": "packages/cli" }
  ]
}
```

注意：`gui` 包不加入 project references，因为它使用 Vite 独立编译。

**Step 3: Commit**

```bash
git add tsconfig.json tsconfig.build.json
git commit -m "chore: add base TypeScript configuration"
```

---

### Task 3: Turborepo 配置

**Files:**
- Create: `turbo.json`

**Step 1: 创建 turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "cache": false
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "lint": {
      "cache": false
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Step 2: Commit**

```bash
git add turbo.json
git commit -m "chore: add Turborepo pipeline configuration"
```

---

### Task 4: Biome 配置

**Files:**
- Create: `biome.json`

**Step 1: 创建 biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always"
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      "target",
      ".turbo",
      "*.json"
    ]
  }
}
```

**Step 2: Commit**

```bash
git add biome.json
git commit -m "chore: add Biome linter and formatter config"
```

---

### Task 5: packages/types 包初始化

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/tsup.config.ts`
- Create: `packages/types/src/index.ts`

**Step 1: 创建目录和 package.json**

```json
{
  "name": "@multiverse/types",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "clean": "rm -rf dist"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: 创建 tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
```

**Step 4: 创建占位入口 src/index.ts**

```typescript
/**
 * Multiverse shared type definitions.
 */
export interface AgentConfig {
  name: string;
  image: string;
  env?: Record<string, string>;
}
```

**Step 5: Commit**

```bash
git add packages/types/
git commit -m "feat: init @multiverse/types package with base types"
```

---

### Task 6: packages/core 包初始化

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/__tests__/index.test.ts`

**Step 1: 创建 package.json**

```json
{
  "name": "@multiverse/core",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "dependencies": {
    "@multiverse/types": "workspace:*"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "clean": "rm -rf dist"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../types" }
  ]
}
```

**Step 3: 创建 tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
```

**Step 4: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 5: 编写 failing test — src/__tests__/index.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { greet } from '../index.js';

describe('core', () => {
  it('should export greet function', () => {
    expect(greet()).toBe('Hello from @multiverse/core');
  });
});
```

**Step 6: 运行测试验证失败**

Run: `cd packages/core && pnpm vitest run`
Expected: FAIL — `greet` is not exported

**Step 7: 创建 src/index.ts 使测试通过**

```typescript
import type { AgentConfig } from '@multiverse/types';

export function greet(): string {
  return 'Hello from @multiverse/core';
}

export type { AgentConfig };
```

**Step 8: 运行测试验证通过**

Run: `cd packages/core && pnpm vitest run`
Expected: PASS

**Step 9: Commit**

```bash
git add packages/core/
git commit -m "feat: init @multiverse/core package with test scaffold"
```

---

### Task 7: Rust 工具链 + Tauri CLI 安装

**Files:** 无文件变更，仅安装工具

**Step 1: 安装 Rust 工具链**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```

**Step 2: 验证安装**

Run: `rustc --version && cargo --version`
Expected: 输出版本号

**Step 3: 安装 Tauri CLI**

```bash
cargo install tauri-cli --version "^2"
```

**Step 4: 验证 Tauri CLI**

Run: `cargo tauri --version`
Expected: 输出 tauri-cli 2.x 版本号

---

### Task 8: packages/cli 包初始化

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsup.config.ts`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/cli.ts`
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/cli/src/__tests__/cli.test.ts`

**Step 1: 创建 package.json**

```json
{
  "name": "@multiverse/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": {
    "multiverse": "./dist/cli.js"
  },
  "files": ["dist"],
  "dependencies": {
    "@multiverse/core": "workspace:*",
    "@multiverse/types": "workspace:*"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "clean": "rm -rf dist"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../types" },
    { "path": "../core" }
  ]
}
```

**Step 3: 创建 tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

**Step 4: 编写 failing test — src/__tests__/cli.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { run } from '../cli.js';

describe('cli', () => {
  it('should return version string', () => {
    expect(run(['--version'])).toBe('multiverse 0.0.1');
  });
});
```

**Step 5: 运行测试验证失败**

Run: `cd packages/cli && pnpm vitest run`
Expected: FAIL

**Step 6: 创建 src/cli.ts**

```typescript
import { greet } from '@multiverse/core';

export function run(args: string[]): string {
  if (args.includes('--version')) {
    return 'multiverse 0.0.1';
  }
  return greet();
}

const args = process.argv.slice(2);
if (args.length > 0) {
  console.log(run(args));
}
```

**Step 7: 创建 src/index.ts**

```typescript
export { run } from './cli.js';
```

**Step 8: 运行测试验证通过**

Run: `cd packages/cli && pnpm vitest run`
Expected: PASS

**Step 9: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 10: Commit**

```bash
git add packages/cli/
git commit -m "feat: init @multiverse/cli package with version command"
```

---

### Task 9: packages/gui 包初始化（Tauri + React）

**Files:**
- Create: `packages/gui/package.json`
- Create: `packages/gui/tsconfig.json`
- Create: `packages/gui/tsconfig.node.json`
- Create: `packages/gui/vite.config.ts`
- Create: `packages/gui/index.html`
- Create: `packages/gui/src/main.tsx`
- Create: `packages/gui/src/App.tsx`
- Create: `packages/gui/src/App.css`
- Create: `packages/gui/src-tauri/Cargo.toml`
- Create: `packages/gui/src-tauri/tauri.conf.json`
- Create: `packages/gui/src-tauri/src/main.rs`
- Create: `packages/gui/src-tauri/src/lib.rs`

**Step 1: 使用 Tauri CLI 初始化**

从项目根目录运行（推荐使用 Tauri 的交互式初始化）：

```bash
cd packages && cargo tauri init --app-name multiverse-gui --window-title "Multiverse" --frontend-dist ../dist --dev-url http://localhost:5173 --before-dev-command "pnpm dev" --before-build-command "pnpm build"
```

如果交互式命令不可用，手动创建以下文件。

**Step 2: 创建 package.json**

```json
{
  "name": "@multiverse/gui",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "dependencies": {
    "@multiverse/core": "workspace:*",
    "@multiverse/types": "workspace:*",
    "@tauri-apps/api": "^2",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "vite": "^6"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri",
    "clean": "rm -rf dist"
  }
}
```

**Step 3: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "outDir": "dist",
    "noEmit": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 4: 创建 tsconfig.node.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 5: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
```

**Step 6: 创建 index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Multiverse</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 7: 创建 src/main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Step 8: 创建 src/App.tsx**

```tsx
import './App.css';

function App() {
  return (
    <main>
      <h1>Multiverse</h1>
      <p>Coding Agent Harness Manager</p>
    </main>
  );
}

export default App;
```

**Step 9: 创建 src/App.css**

```css
:root {
  font-family: system-ui, -apple-system, sans-serif;
  color: #e0e0e0;
  background-color: #1a1a2e;
}

main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
```

**Step 10: 创建 src-tauri/Cargo.toml**

```toml
[package]
name = "multiverse-gui"
version = "0.0.1"
edition = "2021"

[lib]
name = "multiverse_gui_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

**Step 11: 创建 src-tauri/tauri.conf.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "Multiverse",
  "version": "0.0.1",
  "identifier": "dev.multiverse.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "Multiverse",
        "width": 1200,
        "height": 800
      }
    ]
  }
}
```

**Step 12: 创建 src-tauri/src/lib.rs**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 13: 创建 src-tauri/src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    multiverse_gui_lib::run();
}
```

**Step 14: 创建 src-tauri/build.rs**

```rust
fn main() {
    tauri_build::build();
}
```

**Step 15: Commit**

```bash
git add packages/gui/
git commit -m "feat: init @multiverse/gui Tauri + React package"
```

---

### Task 10: 安装依赖 + 验证构建

**Step 1: 安装根级 dev 依赖**

```bash
pnpm add -D -w turbo @biomejs/biome typescript tsup vitest
```

**Step 2: 安装所有 workspace 依赖**

```bash
pnpm install
```

**Step 3: 验证 types 包构建**

Run: `pnpm --filter @multiverse/types build`
Expected: 成功，生成 `packages/types/dist/`

**Step 4: 验证 core 包构建 + 测试**

Run: `pnpm --filter @multiverse/core build && pnpm --filter @multiverse/core test`
Expected: 构建成功 + 测试 PASS

**Step 5: 验证 cli 包构建 + 测试**

Run: `pnpm --filter @multiverse/cli build && pnpm --filter @multiverse/cli test`
Expected: 构建成功 + 测试 PASS

**Step 6: 验证全局 lint**

Run: `pnpm lint`
Expected: 无错误（或仅 warnings）

**Step 7: 验证 Turborepo 全局构建**

Run: `pnpm build`
Expected: 所有包按依赖顺序构建成功

**Step 8: Commit 锁文件**

```bash
git add pnpm-lock.yaml package.json
git commit -m "chore: install dependencies and verify monorepo build"
```

---

### Task 11: Cucumber.js E2E 测试骨架

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/tsconfig.json`
- Create: `e2e/cucumber.mjs`
- Create: `e2e/features/cli.feature`
- Create: `e2e/features/step_definitions/cli.steps.ts`

**注意：** 需要先将 `e2e` 目录加入 `pnpm-workspace.yaml`。

**Step 1: 更新 pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "e2e"
```

**Step 2: 创建 e2e/package.json**

```json
{
  "name": "@multiverse/e2e",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "dependencies": {
    "@cucumber/cucumber": "^11",
    "@multiverse/cli": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4"
  },
  "scripts": {
    "test:e2e": "cucumber-js"
  }
}
```

**Step 3: 创建 e2e/tsconfig.json**

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true
  },
  "include": ["features"]
}
```

**Step 4: 创建 e2e/cucumber.mjs**

```javascript
export default {
  requireModule: ['tsx'],
  require: ['features/step_definitions/**/*.ts'],
  format: ['progress-bar', 'html:reports/cucumber-report.html'],
  publishQuiet: true,
};
```

**Step 5: 编写 Gherkin 场景 — e2e/features/cli.feature**

```gherkin
Feature: CLI version command
  As a developer
  I want to check the CLI version
  So that I know which version I'm running

  Scenario: Display version
    When I run the CLI with "--version"
    Then the output should be "multiverse 0.0.1"
```

**Step 6: 编写 step definitions — e2e/features/step_definitions/cli.steps.ts**

```typescript
import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert';
import { run } from '@multiverse/cli';

let output: string;

When('I run the CLI with {string}', function (args: string) {
  output = run(args.split(' '));
});

Then('the output should be {string}', function (expected: string) {
  assert.strictEqual(output, expected);
});
```

**Step 7: 安装依赖**

```bash
pnpm install
```

**Step 8: 运行 E2E 测试**

Run: `pnpm --filter @multiverse/e2e test:e2e`
Expected: 1 scenario, 2 steps — all passed

**Step 9: 将 reports 加入 gitignore**

在根 `.gitignore` 追加：
```
reports/
```

**Step 10: Commit**

```bash
git add e2e/ pnpm-workspace.yaml .gitignore pnpm-lock.yaml
git commit -m "feat: add Cucumber.js E2E test scaffold with Gherkin"
```

---

### Task 12: 最终验证 + CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

**Step 1: 全量验证**

```bash
pnpm build && pnpm test && pnpm --filter @multiverse/e2e test:e2e && pnpm lint
```

Expected: 全部通过

**Step 2: 创建项目 CLAUDE.md**

```markdown
# Multiverse

Coding agent harness management tool — CLI + Tauri desktop GUI.

## Quick Start

```bash
pnpm install        # Install all dependencies
pnpm build          # Build all packages
pnpm test           # Run unit tests
pnpm lint           # Lint and format check
```

## Project Structure

- `packages/types` — Shared TypeScript type definitions
- `packages/core` — Shared business logic (config parsing, agent lifecycle)
- `packages/cli` — CLI entry point
- `packages/gui` — Tauri desktop app (Rust + React)
- `e2e/` — Cucumber.js E2E tests with Gherkin syntax

## Tech Stack

- Runtime: Node.js 22+
- Package Manager: pnpm workspaces
- Build Orchestration: Turborepo
- Desktop GUI: Tauri 2.x (Rust + React 19 + Vite)
- Linting/Formatting: Biome
- Unit Testing: Vitest
- E2E Testing: Cucumber.js + Gherkin

## Conventions

- All packages use ESM (`"type": "module"`)
- TypeScript strict mode enabled
- Dependency order: types → core → cli/gui
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add project CLAUDE.md"
```

---

## 任务依赖图

```
Task 1 (root config)
  ├── Task 2 (tsconfig)
  ├── Task 3 (turborepo)
  └── Task 4 (biome)
        │
Task 5 (types) ← depends on Tasks 1-4
        │
Task 6 (core) ← depends on Task 5
        │
Task 7 (rust install) ← independent, can run in parallel with 5-6
        │
Task 8 (cli) ← depends on Task 6
Task 9 (gui) ← depends on Tasks 6, 7
        │
Task 10 (install + verify) ← depends on Tasks 8, 9
        │
Task 11 (e2e scaffold) ← depends on Task 10
        │
Task 12 (final verify) ← depends on Task 11
```
