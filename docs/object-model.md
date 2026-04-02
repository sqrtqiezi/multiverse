# Multiverse 对象模型设计

**版本**：1.0  
**日期**：2026-04-02  
**作者**：Claude Opus 4.6

---

## 1. 核心对象模型

### 1.1 类图

```
┌─────────────────────────────────────────────────────────┐
│                    ConfigItem<T>                        │
├─────────────────────────────────────────────────────────┤
│ - id: string                                            │
│ - type: ConfigType                                      │
│ - current: T                                            │
│ - history: VersionEvent<T>[]                            │
├─────────────────────────────────────────────────────────┤
│ + getCurrentVersion(): T                                │
│ + getVersionAt(timestamp): T                            │
│ + createVersion(content: T): void                       │
└─────────────────────────────────────────────────────────┘
                        △
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────┴────────┐ ┌───┴────┐ ┌────────┴────────┐
│ AgentConfigFile│ │ Skill  │ │  McpConfig      │
└────────────────┘ └────────┘ └─────────────────┘


┌─────────────────────────────────────────────────────────┐
│                      Template                           │
├─────────────────────────────────────────────────────────┤
│ - id: string                                            │
│ - name: string                                          │
│ - agentType: AgentType                                  │
│ - snapshot: ConfigSnapshot                              │
│ - createdAt: string                                     │
│ - description?: string                                  │
├─────────────────────────────────────────────────────────┤
│ + export(): JSON                                        │
│ + validate(): boolean                                   │
└─────────────────────────────────────────────────────────┘
                        △
                        │ 不可变引用
                        │
┌─────────────────────────────────────────────────────────┐
│                    Verse (聚合根)                        │
├─────────────────────────────────────────────────────────┤
│ - id: string                                            │
│ - branchName: string                                    │
│ - projectPath: string                                   │
│ - template: Template                                    │
│ - agentVersion: AgentVersion                            │
│ - runs: Run[]                                           │
│ - forkInfo?: VerseForkInfo                              │
│ - createdAt: string                                     │
│ - updatedAt: string                                     │
│ - status: VerseStatus                                   │
├─────────────────────────────────────────────────────────┤
│ + addRun(run: Run): void                                │
│ + getRecentRuns(limit: number): Run[]                   │
│ + archive(): void                                       │
│ + getForkLineage(): Verse[]                             │
└─────────────────────────────────────────────────────────┘
                        │
                        │ 1:N
                        ▼
┌─────────────────────────────────────────────────────────┐
│                       Run (实体)                         │
├─────────────────────────────────────────────────────────┤
│ - id: string                                            │
│ - verseId: string                                       │
│ - startedAt: string                                     │
│ - endedAt?: string                                      │
│ - agentVersion: AgentVersion                            │
│ - containerInfo: ContainerInfo                          │
│ - sessions: Session[]                                   │
│ - workspaceMount: string                                │
│ - status: RunStatus                                     │
│ - exitCode?: number                                     │
├─────────────────────────────────────────────────────────┤
│ + addSession(session: Session): void                    │
│ + complete(exitCode: number): void                      │
│ + getDuration(): number                                 │
└─────────────────────────────────────────────────────────┘
                        │
                        │ 1:N
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Session (实体)                        │
├─────────────────────────────────────────────────────────┤
│ - id: string                                            │
│ - runId: string                                         │
│ - parentSessionId?: string                              │
│ - startedAt: string                                     │
│ - endedAt?: string                                      │
│ - model: string                                         │
│ - traces: OTelTrace[]                                   │
│ - metadata: SessionMetadata                             │
├─────────────────────────────────────────────────────────┤
│ + addTrace(trace: OTelTrace): void                      │
│ + complete(): void                                      │
│ + getMetrics(): SessionMetrics                          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 对象详细定义

### 2.1 ConfigItem（配置项）

**职责**：管理单个配置项的当前版本和历史版本

```typescript
interface ConfigItem<T> {
  id: string;                    // 配置项 ID
  type: ConfigType;              // 配置类型
  current: T;                    // 当前版本的内容
  history: VersionEvent<T>[];    // 版本历史（事件流）
}

type ConfigType = 'agent-config' | 'skill' | 'mcp' | 'rule' | 'subagent';

interface VersionEvent<T> {
  version: string;               // 版本号
  timestamp: string;             // 修改时间
  content: T;                    // 该版本的完整内容
  changeType: 'create' | 'update' | 'delete';
  diff?: string;                 // 可选：与上一版本的 diff
}
```

**方法**：
- `getCurrentVersion()`: 获取当前版本
- `getVersionAt(timestamp)`: 获取指定时间的版本
- `createVersion(content)`: 创建新版本

**存储位置**：`~/.multiverse/config-versions/{type}/{id}.json`

---

### 2.2 AgentConfigFile（Agent 配置文件）

**职责**：表示 agent 的配置文件（CLAUDE.md、agents.md 等）

```typescript
interface AgentConfigFile {
  agentType: AgentType;          // 'claude-code' | 'codex' | 'opencode'
  fileName: string;              // 'CLAUDE.md' | 'agents.md'
  content: string;               // 文件内容
  version: string;               // 版本标识
}

type AgentType = 'claude-code' | 'codex' | 'opencode' | string;
```

---

### 2.3 Skill（技能配置）

**职责**：表示一个 skill 配置

```typescript
interface Skill {
  id: string;                    // 唯一标识
  name: string;                  // skill 名称
  source: SkillSource;           // 来源类型
  content?: string;              // 自定义 skill 的内容
  marketplaceRef?: MarketplaceRef; // marketplace skill 的引用
  enabled: boolean;              // 是否启用
  version: string;               // 版本号
}

type SkillSource = 'custom' | 'marketplace';

interface MarketplaceRef {
  marketplaceId: string;         // marketplace ID
  skillId: string;               // skill 在 marketplace 中的 ID
  version: string;               // 使用的版本
}
```

---

### 2.4 McpConfig（MCP 配置）

**职责**：表示一个 MCP 服务配置

```typescript
interface McpConfig {
  id: string;                    // 唯一标识
  name: string;                  // MCP 服务名称
  command: string;               // 启动命令
  args?: string[];               // 命令参数
  env?: Record<string, string>;  // 环境变量
  enabled: boolean;              // 是否启用
  version: string;               // 版本号
}
```

---

### 2.5 Rule（规则配置）

**职责**：表示一个规则配置

```typescript
interface Rule {
  id: string;                    // 唯一标识
  name: string;                  // 规则名称
  type: RuleType;                // 规则类型
  pattern?: string;              // 匹配模式（正则或 glob）
  action: RuleAction;            // 触发的动作
  enabled: boolean;              // 是否启用
  version: string;               // 版本号
}

type RuleType = 'file-ignore' | 'auto-format' | 'pre-commit' | 'custom';

interface RuleAction {
  type: 'ignore' | 'format' | 'lint' | 'command';
  command?: string;              // 自定义命令
  args?: string[];               // 命令参数
}
```

---

### 2.6 SubagentConfig（Subagent 配置）

**职责**：表示一个 subagent 配置

```typescript
interface SubagentConfig {
  id: string;                    // 唯一标识
  name: string;                  // subagent 名称
  agentType: AgentType;          // agent 类型
  config: AgentConfigFile;       // agent 配置
  resources?: ResourceLimits;    // 资源限制
  enabled: boolean;              // 是否启用
  version: string;               // 版本号
}

interface ResourceLimits {
  maxMemory?: string;            // 最大内存，如 "2G"
  maxCpu?: number;               // 最大 CPU 核心数
  timeout?: number;              // 超时时间（秒）
}
```

---

### 2.7 Template（配置模板）

**职责**：配置快照，创建时冻结所有配置内容

```typescript
interface Template {
  id: string;                    // 唯一标识
  name: string;                  // 用户自定义名称
  agentType: AgentType;          // agent 类型
  snapshot: ConfigSnapshot;      // 配置快照
  createdAt: string;             // 创建时间
  description?: string;          // 可选描述
}

interface ConfigSnapshot {
  agentConfig: AgentConfigFile;  // Agent 配置文件快照
  skills: Skill[];               // Skills 快照
  mcps: McpConfig[];             // MCP 配置快照
  rules: Rule[];                 // Rules 快照
  subagents: SubagentConfig[];   // Subagents 配置快照
}
```

**方法**：
- `export()`: 导出为 JSON
- `validate()`: 验证配置完整性

**存储位置**：`~/.multiverse/templates/{template_id}.json`

**不变性约束**：Template 创建后不可修改

---

### 2.8 Verse（聚合根）

**职责**：代表某个 branch 上的所有运行历史

```typescript
interface Verse {
  id: string;                    // 唯一标识
  branchName: string;            // 关联的 Git branch
  projectPath: string;           // 项目绝对路径
  template: Template;            // 绑定的 template（不可变）
  agentVersion: AgentVersion;    // 创建 verse 时的 agent 版本
  runs: Run[];                   // 该 verse 上的所有 run
  forkInfo?: VerseForkInfo;      // 如果是 fork 出来的，记录来源
  createdAt: string;             // verse 创建时间
  updatedAt: string;             // 最后更新时间
  status: VerseStatus;           // 'active' | 'archived'
}

interface AgentVersion {
  agentType: AgentType;          // agent 类型
  version: string;               // agent 版本号
  dockerImage: string;           // 使用的 Docker 镜像
  detectedAt: string;            // 版本检测时间
}

interface VerseForkInfo {
  parentVerseId: string;         // 父 verse ID
  parentBranchName: string;      // 父 branch 名称
  forkCommit: string;            // fork 时的 commit SHA
  forkTimestamp: string;         // fork 时间
  reason?: string;               // 可选：fork 原因
}

type VerseStatus = 'active' | 'archived';
```

**方法**：
- `addRun(run)`: 添加新的 run
- `getRecentRuns(limit)`: 获取最近的 N 个 run
- `archive()`: 归档 verse
- `getForkLineage()`: 获取派生链

**存储位置**：`.multiverse/verses/{verse_id}.json`

**不变性约束**：
- `template` 字段创建后不可修改
- `agentVersion` 字段创建后不可修改

**聚合根职责**：
- 管理 Run 的生命周期
- 保证数据一致性
- 控制访问边界

---

### 2.9 Run（实体）

**职责**：记录一次完整的容器运行周期

```typescript
interface Run {
  id: string;                    // 唯一标识
  verseId: string;               // 所属的 verse ID
  startedAt: string;             // 容器启动时间
  endedAt?: string;              // 容器退出时间
  agentVersion: AgentVersion;    // 本次 run 使用的 agent 版本
  containerInfo: ContainerInfo;  // 容器信息
  sessions: Session[];           // 该 run 包含的所有 session
  workspaceMount: string;        // 工作区挂载路径
  status: RunStatus;             // 'running' | 'completed' | 'failed'
  exitCode?: number;             // 退出码
}

interface ContainerInfo {
  containerId: string;           // Docker 容器 ID
  image: string;                 // 使用的镜像
  env: Record<string, string>;   // 注入的环境变量
  volumes: VolumeMount[];        // 挂载的卷
}

interface VolumeMount {
  hostPath: string;              // 宿主机路径
  containerPath: string;         // 容器内路径
  mode: 'ro' | 'rw';             // 只读或读写
}

type RunStatus = 'running' | 'completed' | 'failed';
```

**方法**：
- `addSession(session)`: 添加新的 session
- `complete(exitCode)`: 标记 run 完成
- `getDuration()`: 获取运行时长

**生命周期**：
- 创建：容器启动时
- 更新：session 创建/完成时
- 完成：容器退出时

---

### 2.10 Session（实体）

**职责**：记录一次 agent 会话

```typescript
interface Session {
  id: string;                    // 唯一标识
  runId: string;                 // 所属的 run ID
  parentSessionId?: string;      // 父 session ID（subagent）
  startedAt: string;             // session 开始时间
  endedAt?: string;              // session 结束时间
  model: string;                 // 使用的模型
  traces: OTelTrace[];           // OTel 遥测数据
  metadata: SessionMetadata;     // 会话元数据
}

interface SessionMetadata {
  userPrompts: number;           // 用户提示词数量
  assistantResponses: number;    // 助手响应数量
  toolCalls: number;             // 工具调用次数
  tokensUsed: number;            // 总 token 使用量
  errors: SessionError[];        // 错误记录
}

interface SessionError {
  timestamp: string;
  errorType: string;
  message: string;
  stackTrace?: string;
}

interface OTelTrace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;                  // 操作名称
  startTime: string;
  endTime: string;
  attributes: Record<string, any>;
  events: OTelEvent[];
}

interface OTelEvent {
  timestamp: string;
  name: string;
  attributes: Record<string, any>;
}
```

**方法**：
- `addTrace(trace)`: 添加 OTel trace
- `complete()`: 标记 session 完成
- `getMetrics()`: 获取性能指标

**生命周期**：
- 创建：agent 会话开始时
- 更新：OTel 数据上报时
- 完成：agent 会话结束时

---

## 3. 对象关系

### 3.1 聚合关系

```
Verse (聚合根)
  └── Run (实体)
        └── Session (实体)
              └── OTelTrace (值对象)
```

**聚合边界**：
- Verse 是聚合根，控制 Run 和 Session 的访问
- 外部只能通过 Verse 访问 Run 和 Session
- Run 和 Session 不能独立存在

### 3.2 引用关系

```
Template (值对象)
  ↓ 不可变引用
Verse (聚合根)
  ↓ 包含
Run (实体)
  ↓ 包含
Session (实体)
```

**引用约束**：
- Verse 引用 Template（不可变）
- Run 通过 verseId 引用 Verse
- Session 通过 runId 引用 Run
- Session 通过 parentSessionId 自引用（subagent）

### 3.3 派生关系

```
Verse A (main, tpl_001)
  ├─ fork @ commit_1
  │  └─ Verse B (feature/new-config, tpl_002)
  │       └─ fork @ commit_2
  │          └─ Verse C (feature/final, tpl_002)
  └─ fork @ commit_3
     └─ Verse D (feature/experiment, tpl_003)
```

**派生约束**：
- 子 Verse 记录父 Verse ID
- 子 Verse 记录 fork commit SHA
- 派生关系形成树形结构

---

## 4. 对象生命周期

### 4.1 ConfigItem 生命周期

```
创建 → 修改（创建新版本）→ 修改（创建新版本）→ ...
```

**状态转换**：
- 创建：用户首次创建配置
- 修改：用户编辑配置，自动创建新版本
- 删除：标记为 deleted，但保留历史

### 4.2 Template 生命周期

```
创建 → 使用 → 导出/导入 → 删除
```

**状态转换**：
- 创建：从当前配置快照创建
- 使用：被 Verse 引用
- 导出：序列化为 JSON 文件
- 导入：从 JSON 文件反序列化
- 删除：物理删除（如果没有 Verse 引用）

### 4.3 Verse 生命周期

```
创建 → 运行（添加 Run）→ 运行 → ... → 归档
```

**状态转换**：
- 创建：首次在 branch 上运行 `multiverse start`
- 运行：每次启动容器添加新 Run
- 归档：用户手动归档或自动归档（超过阈值）

### 4.4 Run 生命周期

```
创建 → 运行中（添加 Session）→ 完成/失败
```

**状态转换**：
- 创建：容器启动时，status = 'running'
- 运行中：添加 Session，更新 metadata
- 完成：容器正常退出，status = 'completed'
- 失败：容器异常退出，status = 'failed'

### 4.5 Session 生命周期

```
创建 → 运行中（添加 Trace）→ 完成
```

**状态转换**：
- 创建：agent 会话开始时
- 运行中：OTel 数据上报，添加 Trace
- 完成：agent 会话结束时

---

## 5. 设计模式

### 5.1 聚合根模式（Aggregate Root）

**应用**：Verse 是聚合根

**目的**：
- 保证数据一致性
- 控制访问边界
- 简化事务管理

**实现**：
- Verse 管理 Run 的生命周期
- 外部只能通过 Verse 访问 Run
- Run 和 Session 不能独立存在

### 5.2 事件溯源模式（Event Sourcing）

**应用**：ConfigItem 的版本管理

**目的**：
- 保留完整历史
- 支持时间旅行
- 便于审计和回溯

**实现**：
- 每次修改记录为 VersionEvent
- 当前状态通过重放事件计算
- 支持查询任意时间点的状态

### 5.3 快照模式（Snapshot）

**应用**：Template 的配置快照

**目的**：
- 保证不可变性
- 避免引用失效
- 便于对比和分析

**实现**：
- Template 创建时复制所有配置
- 配置修改不影响 Template
- Template 可以独立导出/导入

### 5.4 值对象模式（Value Object）

**应用**：Template、AgentVersion、OTelTrace 等

**目的**：
- 表示不可变的概念
- 通过值相等而非引用相等比较
- 简化对象管理

**实现**：
- 对象创建后不可修改
- 相等性基于内容而非 ID
- 可以自由复制和传递

---

## 6. 数据完整性约束

### 6.1 唯一性约束

- ConfigItem.id 全局唯一
- Template.id 全局唯一
- Verse.id 全局唯一
- Run.id 全局唯一
- Session.id 全局唯一
- (Verse.branchName, Verse.projectPath) 在 active 状态下唯一

### 6.2 引用完整性约束

- Run.verseId 必须引用存在的 Verse
- Session.runId 必须引用存在的 Run
- Session.parentSessionId 必须引用存在的 Session（如果非空）
- VerseForkInfo.parentVerseId 必须引用存在的 Verse

### 6.3 不变性约束

- Template 创建后不可修改
- Verse.template 创建后不可修改
- Verse.agentVersion 创建后不可修改
- Run.verseId 创建后不可修改
- Session.runId 创建后不可修改

### 6.4 业务规则约束

- 同一 branch 同一时间只能有一个 active Verse
- 同一 Verse 同一时间只能有一个 running Run
- Template 被 Verse 引用时不能删除
- Verse 有 running Run 时不能归档

---

## 7. 对象持久化

### 7.1 存储格式

所有对象使用 JSON 格式存储，便于：
- 人类可读
- 版本控制（Git）
- 跨平台兼容
- 易于备份和迁移

### 7.2 存储位置

| 对象 | 存储位置 | 作用域 |
|------|---------|--------|
| ConfigItem | `~/.multiverse/config-versions/{type}/{id}.json` | 全局 |
| Template | `~/.multiverse/templates/{id}.json` | 全局 |
| Verse | `.multiverse/verses/{id}.json` | 项目 |
| Index | `.multiverse/index.json` | 项目 |
| Global Index | `~/.multiverse/global-index.json` | 全局 |

### 7.3 原子写入

所有文件写入使用原子操作：
1. 写入临时文件（`.tmp` 后缀）
2. 调用 `fsync()` 刷盘
3. 原子重命名到目标文件

### 7.4 归档策略

当 Verse.runs 数组超过阈值（100 个）时：
1. 将旧的 run 移到归档文件（`{verse_id}.archive.json`）
2. 主文件只保留最近 100 个 run
3. 查询历史 run 时按需加载归档文件

---

## 8. 对象序列化示例

### 8.1 Template 示例

```json
{
  "id": "tpl_001",
  "name": "默认配置",
  "agentType": "claude-code",
  "snapshot": {
    "agentConfig": {
      "agentType": "claude-code",
      "fileName": "CLAUDE.md",
      "content": "# Project instructions\n...",
      "version": "v3"
    },
    "skills": [
      {
        "id": "skill_001",
        "name": "my-custom-skill",
        "source": "custom",
        "content": "---\nname: my-custom-skill\n...",
        "enabled": true,
        "version": "v1"
      }
    ],
    "mcps": [],
    "rules": [],
    "subagents": []
  },
  "createdAt": "2026-04-01T10:00:00Z",
  "description": "默认开发环境配置"
}
```

### 8.2 Verse 示例

```json
{
  "id": "verse_001",
  "branchName": "main",
  "projectPath": "/home/njin/develop/multiverse",
  "template": {
    "id": "tpl_001",
    "name": "默认配置",
    "agentType": "claude-code",
    "snapshot": { "..." }
  },
  "agentVersion": {
    "agentType": "claude-code",
    "version": "1.2.3",
    "dockerImage": "anthropic/claude-code:1.2.3",
    "detectedAt": "2026-04-01T10:00:00Z"
  },
  "runs": [
    {
      "id": "run_001",
      "verseId": "verse_001",
      "startedAt": "2026-04-01T10:05:00Z",
      "endedAt": "2026-04-01T10:30:00Z",
      "agentVersion": { "..." },
      "containerInfo": { "..." },
      "sessions": [],
      "workspaceMount": "/home/njin/develop/multiverse",
      "status": "completed",
      "exitCode": 0
    }
  ],
  "forkInfo": null,
  "createdAt": "2026-04-01T10:00:00Z",
  "updatedAt": "2026-04-01T10:30:00Z",
  "status": "active"
}
```

---

## 9. 总结

### 9.1 设计原则

1. **聚合根模式**：Verse 作为聚合根，保证数据一致性
2. **事件溯源**：ConfigItem 通过事件流管理版本历史
3. **快照模式**：Template 通过快照保证不可变性
4. **值对象**：不可变对象简化管理
5. **引用完整性**：严格的引用约束保证数据完整性

### 9.2 关键约束

1. **Template 不可变**：创建后不可修改
2. **Verse-Template 绑定不可变**：创建后不可修改
3. **聚合边界**：外部只能通过 Verse 访问 Run 和 Session
4. **唯一性**：同一 branch 同一时间只能有一个 active Verse

### 9.3 扩展性

1. **新 Agent 支持**：通过 AgentType 扩展
2. **新配置项支持**：通过 ConfigItem<T> 泛型支持
3. **新可视化**：通过 OTel traces 扩展
4. **新分析维度**：通过 metadata 扩展
