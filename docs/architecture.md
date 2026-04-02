# Multiverse 系统架构设计

**版本**：1.0  
**日期**：2026-04-02  
**作者**：Claude Opus 4.6

---

## 1. 系统架构概览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         用户层                               │
├─────────────────────────────────────────────────────────────┤
│  CLI (multiverse start)    │  GUI (Tauri Desktop App)       │
│  - 命令解析                │  - 配置管理界面                 │
│  - 交互式 wizard           │  - 数据可视化                   │
│  - 容器生命周期管理        │  - 实时监控                     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Core 层                                 │
├─────────────────────────────────────────────────────────────┤
│  ConfigManager      — 配置文件读写、版本管理                │
│  TemplateManager    — Template CRUD、快照创建                │
│  VerseManager       — Verse 生命周期、Fork 追踪              │
│  ContainerManager   — Docker 容器管理、凭证注入              │
│  OTelCollector      — 遥测数据采集、存储                     │
│  IndexManager       — 索引文件维护、快速查询                 │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     存储层                                   │
├─────────────────────────────────────────────────────────────┤
│  全局存储 (~/.multiverse/)  │  项目存储 (.multiverse/)      │
│  • templates/               │  • verses/                    │
│  • config-versions/         │  • index.json                 │
│  • marketplaces/            │                               │
│  • global-index.json        │                               │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   运行时层                                   │
├─────────────────────────────────────────────────────────────┤
│  Docker 容器 (claude-code / codex / opencode)               │
│  • 挂载工作区                                                │
│  • 注入配置文件                                              │
│  • 注入登录凭证                                              │
│  • 注入 OTel Agent                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 分层架构

### 2.1 用户层（Presentation Layer）

#### 2.1.1 CLI

**职责**：
- 解析命令行参数
- 提供交互式 wizard
- 调用 Core 层 API
- 显示执行结果

**技术栈**：
- Node.js 22+
- TypeScript
- Commander.js（命令行解析）
- Inquirer.js（交互式提示）

**主要命令**：
```bash
multiverse start [--template <id>] [--agent-version <ver>]
multiverse --version
multiverse --help
```

#### 2.1.2 GUI

**职责**：
- 配置管理界面
- 数据可视化
- 实时监控
- 性能分析

**技术栈**：
- Tauri 2.x（Rust 后端 + React 前端）
- React 19
- Vite
- Monaco Editor（代码编辑）
- React Flow（流程图）
- ECharts（数据图表）
- xterm.js（终端日志）

**主要模块**：
- 配置管理模块
- Template 管理模块
- Verse 管理模块
- Run 监控模块
- 数据分析模块

---

### 2.2 Core 层（Business Logic Layer）

#### 2.2.1 ConfigManager

**职责**：配置文件的读写和版本管理

**接口**：
```typescript
interface ConfigManager {
  // 读取配置
  getConfig<T>(type: ConfigType, id: string): ConfigItem<T>;
  getCurrentVersion<T>(type: ConfigType, id: string): T;
  getVersionAt<T>(type: ConfigType, id: string, timestamp: string): T;
  
  // 写入配置
  saveConfig<T>(type: ConfigType, id: string, content: T): void;
  createVersion<T>(type: ConfigType, id: string, content: T): string;
  
  // 查询配置
  listConfigs(type: ConfigType): ConfigItem<any>[];
  searchConfigs(type: ConfigType, query: string): ConfigItem<any>[];
}
```

**实现要点**：
- 使用事件溯源管理版本历史
- 原子写入保证数据一致性
- 支持并发读，串行写（文件锁）

---

#### 2.2.2 TemplateManager

**职责**：Template 的 CRUD 和快照创建

**接口**：
```typescript
interface TemplateManager {
  // CRUD
  createTemplate(name: string, agentType: AgentType): Template;
  getTemplate(id: string): Template;
  listTemplates(): Template[];
  deleteTemplate(id: string): void;
  
  // 快照
  createSnapshot(): ConfigSnapshot;
  
  // 导入/导出
  exportTemplate(id: string): string;
  importTemplate(json: string): Template;
  
  // 查询
  getTemplateUsage(id: string): Verse[];
}
```

**实现要点**：
- 创建 template 时深拷贝所有配置
- 删除前检查是否被 verse 引用
- 导出时包含完整的配置快照

---

#### 2.2.3 VerseManager

**职责**：Verse 的生命周期管理和 Fork 追踪

**接口**：
```typescript
interface VerseManager {
  // 生命周期
  getOrCreateVerse(branchName: string, templateId: string): Verse;
  getVerse(id: string): Verse;
  listVerses(projectPath: string): Verse[];
  archiveVerse(id: string): void;
  
  // Fork 追踪
  forkVerse(parentId: string, newBranch: string, templateId: string): Verse;
  getForkLineage(id: string): Verse[];
  getVersesAtCommit(commit: string): Verse[];
  
  // Run 管理
  addRun(verseId: string, run: Run): void;
  getRecentRuns(verseId: string, limit: number): Run[];
  
  // 查询
  getActiveVerse(branchName: string): Verse | null;
  compareVerses(id1: string, id2: string): ComparisonResult;
}
```

**实现要点**：
- 检查 template 绑定不可变约束
- 记录 fork 信息（父 verse、commit SHA）
- 维护项目索引文件

---

#### 2.2.4 ContainerManager

**职责**：Docker 容器的启动、停止和配置注入

**接口**：
```typescript
interface ContainerManager {
  // 容器生命周期
  startContainer(verse: Verse, agentVersion: AgentVersion): Run;
  stopContainer(runId: string): void;
  getContainerStatus(runId: string): ContainerStatus;
  
  // 配置注入
  injectConfig(containerId: string, snapshot: ConfigSnapshot): void;
  injectCredentials(containerId: string): void;
  injectOTelAgent(containerId: string, runId: string): void;
  
  // 工作区管理
  mountWorkspace(containerId: string, projectPath: string): void;
  
  // Agent 版本管理
  detectAgentVersion(agentType: AgentType): AgentVersion;
  pullImage(image: string): void;
}
```

**实现要点**：
- 检测 Docker 可用性
- 支持多种 agent 类型（通过配置）
- 凭证只读挂载
- 工作区读写挂载
- 容器使用非 root 用户

---

#### 2.2.5 OTelCollector

**职责**：OTel 遥测数据的采集和存储

**接口**：
```typescript
interface OTelCollector {
  // 采集控制
  startCollecting(runId: string): void;
  stopCollecting(runId: string): void;
  
  // 数据处理
  onTraceReceived(trace: OTelTrace): void;
  onSpanReceived(span: OTelSpan): void;
  
  // 查询
  getTraces(sessionId: string): OTelTrace[];
  getSessionMetrics(sessionId: string): SessionMetrics;
}
```

**实现要点**：
- 启动 OTLP receiver（HTTP/gRPC）
- 实时写入 session traces
- 支持数据采样（避免过大）
- 异步处理，不阻塞容器运行

---

#### 2.2.6 IndexManager

**职责**：维护索引文件，加速查询

**接口**：
```typescript
interface IndexManager {
  // 项目索引
  updateProjectIndex(projectPath: string): void;
  getProjectIndex(projectPath: string): ProjectIndex;
  
  // 全局索引
  updateGlobalIndex(): void;
  getGlobalIndex(): GlobalIndex;
  
  // 查询
  findVersesByTemplate(templateId: string): Verse[];
  findRecentProjects(limit: number): ProjectInfo[];
}
```

**实现要点**：
- 增量更新索引（不全量扫描）
- 索引文件小于 10KB
- 索引损坏时自动重建

---

### 2.3 存储层（Data Layer）

#### 2.3.1 全局存储

**位置**：`~/.multiverse/`

**结构**：
```
~/.multiverse/
├── templates/
│   ├── tpl_001.json
│   ├── tpl_002.json
│   └── ...
├── config-versions/
│   ├── agent-configs/
│   │   ├── ac_001.json
│   │   └── ...
│   ├── skills/
│   ├── mcps/
│   ├── rules/
│   └── subagents/
├── marketplaces/
│   ├── superpowers-marketplace/
│   │   ├── metadata.json
│   │   └── skills/
│   └── ...
└── global-index.json
```

**特点**：
- 跨项目共享
- 用户级配置
- 不进入版本控制

---

#### 2.3.2 项目存储

**位置**：`.multiverse/`

**结构**：
```
.multiverse/
├── verses/
│   ├── verse_001.json
│   ├── verse_001.archive.json
│   ├── verse_002.json
│   └── ...
├── index.json
└── .gitignore
```

**特点**：
- 项目级配置
- 可选进入版本控制
- 支持团队协作

---

### 2.4 运行时层（Runtime Layer）

#### 2.4.1 Docker 容器

**镜像**：
- `anthropic/claude-code:1.2.3`
- `openai/codex:latest`
- `opencode/agent:latest`

**挂载**：
```
宿主机                          容器
/home/user/project       →     /workspace (rw)
~/.claude                →     /root/.claude (ro)
~/.multiverse/templates  →     /config (ro)
```

**环境变量**：
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
OTEL_SERVICE_NAME=claude-code
OTEL_RESOURCE_ATTRIBUTES=verse.id=verse_001,run.id=run_001
```

**网络**：
- 容器可以访问宿主机（OTel collector）
- 容器可以访问外部网络（API 调用）
- 容器之间隔离

---

## 3. 数据流

### 3.1 启动流程

```
用户执行 multiverse start --template tpl_001
  ↓
CLI 解析参数
  ↓
VerseManager.getOrCreateVerse()
  ├─ 检查当前 branch
  ├─ 检查 template 匹配
  └─ 创建或获取 verse
  ↓
TemplateManager.getTemplate(tpl_001)
  └─ 读取 template 快照
  ↓
ContainerManager.detectAgentVersion()
  └─ 检测 agent 版本
  ↓
ContainerManager.startContainer()
  ├─ 拉取镜像
  ├─ 创建容器
  ├─ 挂载工作区
  ├─ 注入配置
  ├─ 注入凭证
  ├─ 注入 OTel Agent
  └─ 启动容器
  ↓
VerseManager.addRun()
  ├─ 创建 Run 对象
  ├─ 记录 startedAt
  └─ 保存到 verse
  ↓
OTelCollector.startCollecting()
  └─ 启动 OTLP receiver
  ↓
进入交互模式
  ↓
用户与 agent 交互
  ↓
OTel 数据实时上报
  ├─ OTelCollector.onTraceReceived()
  └─ 写入 session.traces[]
  ↓
用户退出
  ↓
ContainerManager.stopContainer()
  ├─ 停止容器
  └─ 清理容器
  ↓
OTelCollector.stopCollecting()
  └─ 完成数据写入
  ↓
VerseManager.addRun()
  ├─ 更新 Run 对象
  ├─ 记录 endedAt
  └─ 保存到 verse
  ↓
IndexManager.updateProjectIndex()
  └─ 更新索引文件
```

---

### 3.2 配置修改流程

```
用户在 GUI 中编辑 CLAUDE.md
  ↓
Monaco Editor 内容变化
  ↓
用户点击"保存"
  ↓
ConfigManager.saveConfig()
  ├─ 读取当前版本
  ├─ 创建 VersionEvent
  ├─ 更新 current
  ├─ 追加到 history
  └─ 原子写入文件
  ↓
GUI 刷新版本历史列表
```

---

### 3.3 Template 创建流程

```
用户在 GUI 中点击"创建 Template"
  ↓
TemplateManager.createSnapshot()
  ├─ 读取所有配置项的 current 版本
  ├─ 深拷贝配置内容
  └─ 创建 ConfigSnapshot
  ↓
用户输入 template 名称和描述
  ↓
TemplateManager.createTemplate()
  ├─ 生成 template_id
  ├─ 创建 Template 对象
  └─ 写入文件
  ↓
IndexManager.updateGlobalIndex()
  └─ 更新全局索引
  ↓
GUI 刷新 template 列表
```

---

### 3.4 Verse Fork 流程

```
用户在 branch A 上运行 multiverse start --template tpl_002
  ↓
VerseManager.getActiveVerse(branch_A)
  └─ 返回 verse_A (template: tpl_001)
  ↓
检测到 template 不匹配
  ↓
CLI 提示用户选择操作
  ↓
用户选择"创建新 branch"
  ↓
CLI 执行 git checkout -b feature/new-config
  ↓
CLI 执行 git rev-parse HEAD
  └─ 获取当前 commit SHA
  ↓
VerseManager.forkVerse()
  ├─ 创建 VerseForkInfo
  │   ├─ parentVerseId = verse_A.id
  │   ├─ forkCommit = current_commit_sha
  │   └─ reason = "Template changed"
  ├─ 创建新 verse
  └─ 写入文件
  ↓
IndexManager.updateProjectIndex()
  ├─ 添加新 branch 记录
  └─ 更新 verseForkGraph
  ↓
继续启动容器流程
```

---

## 4. 技术选型

### 4.1 Monorepo 管理

**选型**：pnpm + Turborepo

**理由**：
- pnpm：性能好、原生 monorepo 支持
- Turborepo：任务缓存、依赖图感知、增量构建

**包结构**：
```
packages/
├── types/      # 共享类型定义
├── core/       # 共享业务逻辑
├── cli/        # CLI 入口
└── gui/        # Tauri 桌面应用
```

---

### 4.2 TypeScript 编译

**选型**：tsup（CLI/core/types）、Vite（GUI 前端）

**理由**：
- tsup：基于 esbuild，编译速度快
- Vite：Tauri 官方推荐，HMR 支持好

---

### 4.3 Lint/Format

**选型**：Biome

**理由**：
- 快速（Rust 实现）
- 零配置
- 替代 ESLint + Prettier

---

### 4.4 测试

**选型**：Vitest（单元测试）、Cucumber.js（E2E 测试）

**理由**：
- Vitest：与 Vite 生态一致，monorepo 支持好
- Cucumber.js：BDD 风格，Gherkin 语法易读

---

### 4.5 容器管理

**选型**：Dockerode（Node.js Docker API）

**理由**：
- 原生 TypeScript 支持
- 完整的 Docker API 封装
- 支持 Docker 和 Podman

---

### 4.6 OTel 采集

**选型**：@opentelemetry/sdk-node

**理由**：
- 官方 SDK
- 支持 OTLP 协议
- 易于集成

---

### 4.7 GUI 可视化

| 需求 | 选型 | 理由 |
|------|------|------|
| 代码编辑 | Monaco Editor | VS Code 同款，功能强大 |
| 流程图 | React Flow | 易用、性能好、可定制 |
| 数据图表 | ECharts | 功能全面、文档完善 |
| 终端日志 | xterm.js | 完整的终端模拟器 |

---

## 5. 部署架构

### 5.1 CLI 部署

**发布方式**：npm package

**安装**：
```bash
npm install -g @multiverse/cli
```

**依赖**：
- Node.js 22+
- Docker（或 Podman）

---

### 5.2 GUI 部署

**发布方式**：Tauri 桌面应用

**平台**：
- Linux：AppImage / deb / rpm
- macOS：dmg / app
- Windows：msi / exe

**依赖**：
- 系统 webview（无需 Electron）
- Docker（或 Podman）

---

## 6. 性能优化

### 6.1 文件读写优化

- 使用流式读取大文件
- 原子写入避免损坏
- 索引文件加速查询
- 归档机制控制文件大小

### 6.2 容器启动优化

- 预拉取常用镜像
- 复用容器配置
- 并行注入配置和凭证

### 6.3 GUI 渲染优化

- 虚拟滚动（大列表）
- 懒加载（图表数据）
- Web Worker（数据处理）
- React.memo（避免重渲染）

### 6.4 OTel 数据优化

- 采样（只记录关键 span）
- 批量上报（减少网络开销）
- 异步写入（不阻塞容器）
- 压缩存储（减少磁盘占用）

---

## 7. 安全设计

### 7.1 凭证管理

- 宿主机凭证只读挂载
- 容器内凭证文件权限 600
- GUI 不显示完整凭证

### 7.2 容器隔离

- 容器使用非 root 用户
- 网络隔离（只允许必要端点）
- 工作区最小权限挂载

### 7.3 数据隐私

- OTel 数据不包含敏感信息
- 配置文件敏感字段加密
- GUI 日志脱敏显示

---

## 8. 可靠性设计

### 8.1 数据持久化

- 原子写入（write + rename）
- 立即刷盘（fsync）
- 自动备份（定期）

### 8.2 错误处理

- 容器启动失败回滚
- 配置损坏自动恢复
- OTel 采集失败不影响运行

### 8.3 并发控制

- 同一 branch 不允许多容器
- 配置写入使用文件锁
- Verse 更新使用乐观锁

---

## 9. 监控与日志

### 9.1 日志

**格式**：JSON 结构化日志

**级别**：debug / info / warn / error

**输出**：
- CLI：stdout / stderr
- GUI：文件（~/.multiverse/logs/）

**轮转**：按天或按大小（10MB）

### 9.2 监控

**指标**：
- 容器启动成功率
- 配置文件读写延迟
- OTel 数据上报延迟
- GUI 页面加载时间

**告警**：
- 容器启动失败
- 配置文件损坏
- 磁盘空间不足

---

## 10. 总结

### 10.1 架构特点

1. **分层清晰**：用户层、Core 层、存储层、运行时层
2. **职责分离**：CLI 负责运行时，GUI 负责管理
3. **模块化**：Core 层各模块独立，易于测试和维护
4. **可扩展**：支持新 agent、新配置项、新可视化

### 10.2 关键设计

1. **聚合根模式**：Verse 作为聚合根，保证数据一致性
2. **事件溯源**：ConfigItem 通过事件流管理版本
3. **快照模式**：Template 通过快照保证不可变性
4. **索引加速**：通过索引文件加速查询

### 10.3 技术亮点

1. **Monorepo**：pnpm + Turborepo 管理多包
2. **Tauri**：轻量级桌面应用，无需 Electron
3. **OTel**：标准化遥测数据采集
4. **Docker**：容器化隔离，支持多 agent
