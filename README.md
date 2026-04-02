# Multiverse

`Multiverse` 是一个用于管理 Coding Agent 运行环境的工具仓库。当前版本聚焦于一个可落地的 MVP：通过 `multiverse start` 在 Docker 中快速启动 `claude-code`。

## 当前状态

- 版本：`0.0.1`
- 已实现：
  - CLI 基础命令（`start`、`--version`）
  - Docker 可用性检测
  - 本地自动构建镜像 `multiverse/claude-code:latest`
  - Claude 凭证自动发现与注入
  - 将当前目录挂载到容器 `/workspace` 并进入交互模式
- 进行中：GUI（Tauri + React）目前是基础壳层

## Monorepo 结构

本项目使用 `pnpm workspace + turbo`：

```text
.
├─ packages/
│  ├─ cli/      # 命令行入口（multiverse）
│  ├─ core/     # Docker / credential 等核心能力
│  ├─ gui/      # Tauri + React 桌面端
│  └─ types/    # 共享类型定义
├─ e2e/         # Cucumber 端到端测试
└─ docs/        # 架构与规划文档
```

## 环境要求

- Node.js `>= 22`
- pnpm `9.4.0`（见根 `package.json`）
- Docker（本地可执行 `docker ps`）
- Claude 登录凭证（满足其一）：
  - `~/.claude/credentials.json` 或 `~/.claude/.credentials`
  - 环境变量：`ANTHROPIC_*` 或 `CLAUDE_CODE_*`（例如 `ANTHROPIC_API_KEY`）

## 快速开始

```bash
pnpm install
pnpm build
```

构建后可直接运行 CLI：

```bash
node packages/cli/dist/cli.js --version
node packages/cli/dist/cli.js start
```

`start` 命令执行流程：

1. 检查 Docker 可用性  
2. 检查/构建镜像 `multiverse/claude-code:latest`
3. 自动解析 Claude 凭证并注入容器
4. 挂载当前目录到容器 `/workspace`
5. 进入 `claude-code` 交互会话

## 常用脚本

根目录：

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm lint
pnpm lint:fix
pnpm format
pnpm tauri:dev
pnpm tauri:build
```

包级示例：

```bash
pnpm --filter @multiverse/cli dev
pnpm --filter @multiverse/core test
pnpm --filter @multiverse/gui tauri:dev
```

## 测试说明

- 单元测试：`vitest`
- E2E：`cucumber-js`（位于 `e2e/`）
- Docker 相关 E2E 场景默认受环境变量控制，仅在设置 `MULTIVERSE_E2E_DOCKER=1` 时执行 Docker 依赖步骤

## 故障排查

- 提示 `Docker is not available`：
  - 确认 Docker 已安装并启动
  - 在终端先验证 `docker ps`
- 提示 `Claude credentials not found`：
  - 先执行 `claude login`，或
  - 导出 `ANTHROPIC_API_KEY` 等环境变量后重试
- 首次启动较慢：
  - 需要构建 `multiverse/claude-code:latest`，属于预期行为

## 相关文档

- 架构设计：`docs/architecture.md`
- 产品需求：`docs/prd.md`
- 对象模型：`docs/object-model.md`
