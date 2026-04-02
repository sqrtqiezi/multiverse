# Multiverse — Coding Agent Harness 管理工具设计文档

## 项目定位

Multiverse 是一个面向开发者的 coding agent harness 管理工具：

- **CLI** — 主入口，启动/管理容器化的 Claude Code 等 coding agent
- **桌面 GUI（Tauri）** — 提供 skills/MCP/CLAUDE.md 配置管理，以及数据图表、流程拓扑、实时日志、富文本编辑等可视化能力

## Monorepo 结构

```
multiverse/
├── packages/
│   ├── cli/              # CLI 主包 — Node.js + TypeScript
│   ├── gui/              # Tauri 桌面应用 — Rust 后端 + React 前端
│   ├── core/             # 共享核心逻辑 — 配置解析、agent 管理接口
│   └── types/            # 共享 TypeScript 类型定义
├── pnpm-workspace.yaml
├── package.json          # 根级 scripts、dev dependencies
├── tsconfig.json         # 基础 TS 配置
├── biome.json            # Linting + Formatting
└── turbo.json            # Turborepo 构建编排
```

### 包职责

| 包 | 职责 |
|---|---|
| `types` | 纯类型定义，零运行时依赖 |
| `core` | 共享业务逻辑：配置文件解析（CLAUDE.md、skills、MCP）、agent 生命周期接口、容器管理抽象 |
| `cli` | 用户主入口，依赖 `core`，提供命令行交互 |
| `gui` | Tauri 应用。Rust 后端：文件监听、进程管理。React 前端：可视化与配置 UI |

## 技术栈

| 层面 | 选型 | 理由 |
|---|---|---|
| 运行时 | Node.js 22+ | 原生 ESM、内置 test runner |
| 语言 | TypeScript 5.x (strict) | 类型安全，所有包共用 |
| 包管理 | pnpm + workspaces | 性能好、原生 monorepo 支持 |
| 构建编排 | Turborepo | 任务缓存、依赖图感知、增量构建 |
| 桌面 GUI | Tauri 2.x | Rust 后端 + 系统 webview |
| 前端 | React 19 + Vite | Tauri 官方模板支持 |
| 可视化 | ECharts + React Flow + Monaco + xterm.js | 覆盖图表、拓扑、编辑器、日志四类需求 |
| TS 编译 | tsup（CLI/core/types）、Vite（GUI 前端） | esbuild 驱动，编译速度快 |
| Lint/Format | Biome | 快速、零配置、替代 ESLint + Prettier |
| 单元测试 | Vitest | 与 Vite 生态一致，monorepo 支持好 |
| E2E 测试 | Cucumber.js + Gherkin | BDD 风格端到端测试 |

## 包间依赖与数据流

```
              ┌─────────┐
              │  types   │  ← 纯类型定义，零运行时依赖
              └────┬─────┘
                   │
              ┌────▼─────┐
              │   core   │  ← 共享业务逻辑
              └────┬─────┘
                   │
         ┌─────────┼──────────┐
         │                    │
    ┌────▼─────┐        ┌────▼─────┐
    │   cli    │        │   gui    │
    │ (Node)   │        │ (Tauri)  │
    └──────────┘        └──────────┘
         │                    │
         └──────┬─────────────┘
                │
         ┌──────▼──────┐
         │  容器/Agent  │  ← Docker 容器中的 Claude Code 等
         └─────────────┘
```

- `types` → 所有包引用，构建时依赖
- `core` → CLI 和 GUI 共用，配置文件读写、agent 生命周期管理
- `cli` → 调用 `core` 启动容器、管理 agent；可通过命令打开 GUI
- `gui` → Rust 后端通过 Tauri IPC 与 React 前端通信；前端通过打包的 `core` 访问共享逻辑

## 可视化能力

| 需求 | 方案 |
|---|---|
| 数据图表（折线/柱状/饼图） | ECharts |
| 流程/拓扑图（agent 调用链、MCP 拓扑） | React Flow |
| 实时日志/状态监控 | xterm.js |
| 富文本/Markdown 编辑预览 | Monaco Editor |
