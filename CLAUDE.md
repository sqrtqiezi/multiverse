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
