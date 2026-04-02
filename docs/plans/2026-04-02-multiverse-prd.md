# Multiverse 产品需求文档（PRD）

**版本**：1.0  
**日期**：2026-04-02  
**作者**：Claude Opus 4.6

---

## 1. 产品概述

### 1.1 产品定位

Multiverse 是一个面向开发者的 coding agent harness 管理工具，提供：

- **CLI**：启动和管理容器化的 coding agent（claude-code、codex、opencode 等）
- **桌面 GUI（Tauri）**：配置管理、运行监控、数据分析、可视化

### 1.2 核心价值

1. **配置管理**：统一管理 agent 配置、skills、MCPs、rules、subagents
2. **版本控制**：自动记录配置历史，支持回溯和对比
3. **运行追踪**：记录每次运行的完整上下文（配置、版本、性能）
4. **数据分析**：可视化性能指标，对比不同配置的效果
5. **多 Agent 支持**：统一接口支持多种 coding agent

### 1.3 目标用户

- 使用 coding agent 的开发者
- 需要管理多套配置的团队
- 需要追踪 agent 性能的研究人员

---

## 2. 核心概念

### 2.1 配置项（ConfigItem）

单个配置的当前版本和历史版本，包括：
- Agent 配置文件（CLAUDE.md、agents.md 等）
- Skills（自定义 + Marketplace）
- MCPs
- Rules
- Subagents

**特性**：
- 每次修改自动创建新版本（事件溯源）
- 保留完整历史记录
- 支持版本对比和回溯

### 2.2 Template（配置模板）

配置的快照，创建时冻结所有配置内容。

**特性**：
- 不可变（创建后不可修改）
- 包含完整的配置快照
- 跨项目共享（存储在 `~/.multiverse/templates/`）

### 2.3 Verse（聚合根）

代表某个 Git branch 上的所有运行历史。

**特性**：
- 每个 branch 对应一个 verse
- 与 template 绑定不可变
- 记录 agent 版本信息
- 支持 fork 追踪（记录派生关系和起始 commit）
- 包含该 branch 上的所有 run

### 2.4 Run（运行实例）

一次完整的容器运行周期。

**特性**：
- 记录启动/退出时间
- 记录使用的 agent 版本
- 包含多个 session
- 记录容器信息和工作区挂载

### 2.5 Session（会话）

一次 agent 会话，包含 OTel 遥测数据。

**特性**：
- 记录模型、提示词、API 调用、tool 使用
- 支持 subagent（通过 parentSessionId 关联）
- 包含完整的 OTel traces

---

## 3. 功能需求

### 3.1 CLI 功能

#### 3.1.1 启动容器

```bash
multiverse start [--template <id>] [--agent-version <ver>]
```

**功能**：
- 检测当前 branch 的 verse
- 如果没有 verse，创建新 verse
- 如果 template 不匹配，提示用户创建新 branch
- 启动 Docker 容器
- 注入配置文件和登录凭证
- 注入 OTel Agent
- 进入交互模式
- 退出时清理容器，保存 run 数据

**交互流程**：
1. 未指定 template：进入 wizard 选择或配置
2. Template 不匹配：提示创建新 branch 或归档旧 verse
3. Agent 版本不匹配：提示使用新版本或固定旧版本

#### 3.1.2 版本查看

```bash
multiverse --version
multiverse --help
```

---

### 3.2 GUI 功能

#### 3.2.1 配置管理模块

**功能**：
- 管理 Agent 配置文件（支持多种 agent 类型）
- 管理 Skills（自定义 + Marketplace）
- 管理 MCPs、Rules、Subagents
- Monaco Editor 编辑器（语法高亮 + 自动补全）
- 查看配置版本历史
- 版本对比和回溯

**界面**：
- 左侧：配置项树形导航
- 右侧：编辑区域 + 版本历史

#### 3.2.2 Template 管理模块

**功能**：
- 创建 Template（从当前配置快照）
- 查看 Template 列表
- 查看 Template 详情（配置内容、使用情况）
- 删除 Template
- 导出/导入 Template

**界面**：
- Template 卡片列表
- Template 详情页

#### 3.2.3 Verse 管理模块

**功能**：
- 查看所有项目的 verse 列表
- 查看 verse 详情（runs、sessions、性能统计）
- Verse 派生关系可视化（React Flow）
- Verse 归档

**界面**：
- Verse 列表（按项目分组）
- Verse 详情页（基本信息 + Runs + 性能分析 + 派生关系）
- 派生关系图（树形可视化）

#### 3.2.4 Run 监控模块

**功能**：
- 实时查看正在运行的 Run
- 查看 Run 详情（sessions、traces）
- 实时日志查看（xterm.js）
- Session 调用链可视化（React Flow）
- OTel traces 查看

**界面**：
- Run 列表（正在运行 + 历史记录）
- Run 详情页（概览 + Sessions + 日志 + Traces）
- Session 调用链图

#### 3.2.5 数据分析模块

**功能**：
- 跨 verse 性能对比
- Agent 版本对比分析
- Template 效果分析
- 时间序列分析（ECharts）

**界面**：
- 分析类型选择
- Verse/Template 选择
- 图表展示（柱状图、折线图、饼图）
- 分析报告生成

---

## 4. 非功能性需求

### 4.1 性能要求

| 指标 | 目标 |
|------|------|
| CLI 启动时间 | < 2s |
| GUI 启动时间 | < 3s |
| 容器启动时间 | < 10s |
| 配置文件读取 | < 100ms |
| GUI 页面切换 | < 500ms |
| 实时日志延迟 | < 100ms |

### 4.2 可靠性要求

- 所有配置文件使用原子写入
- 容器异常退出时自动保存状态
- 配置文件损坏时自动从备份恢复
- 同一 branch 不允许同时启动多个容器

### 4.3 安全性要求

- 宿主机凭证只读挂载到容器
- 容器使用非 root 用户运行
- OTel 数据不包含敏感信息
- GUI 日志查看支持敏感信息脱敏

### 4.4 可扩展性要求

- 通过配置文件添加新 agent 类型
- ConfigItem 支持任意类型的配置
- GUI 支持自定义可视化插件

---

## 5. 用户故事

### 5.1 配置管理

**作为**开发者  
**我想要**在 GUI 中编辑 CLAUDE.md  
**以便**快速调整 agent 行为

**验收标准**：
- 可以在 Monaco Editor 中编辑配置
- 保存后自动创建新版本
- 可以查看版本历史
- 可以对比两个版本的差异

---

### 5.2 Template 创建

**作为**开发者  
**我想要**将当前配置保存为 template  
**以便**在不同项目中复用

**验收标准**：
- 可以一键创建 template
- Template 包含所有配置的快照
- Template 可以跨项目使用
- Template 可以导出/导入

---

### 5.3 容器启动

**作为**开发者  
**我想要**使用指定的 template 启动 claude-code  
**以便**在隔离环境中工作

**验收标准**：
- 可以通过 CLI 指定 template
- 容器自动注入配置和凭证
- 进入交互模式后可以正常使用
- 退出后自动保存运行数据

---

### 5.4 性能分析

**作为**开发者  
**我想要**对比两个 template 的性能  
**以便**选择更优的配置

**验收标准**：
- 可以选择多个 verse 进行对比
- 显示运行时长、tool 调用次数等指标
- 显示图表可视化
- 可以导出分析报告

---

### 5.5 Verse Fork

**作为**开发者  
**我想要**在换 template 时自动创建新 branch  
**以便**保持配置和代码的对应关系

**验收标准**：
- Template 不匹配时自动提示
- 可以一键创建新 branch
- 新 verse 记录 fork 信息（父 verse、fork commit）
- 可以在 GUI 中查看派生关系

---

## 6. 技术约束

### 6.1 依赖

- Docker（或 Podman）
- Node.js 22+
- Git

### 6.2 平台支持

- Linux
- macOS
- Windows（WSL2）

### 6.3 存储

- 全局配置：`~/.multiverse/`
- 项目配置：`.multiverse/`
- 单个 verse 文件 < 1MB（通过归档控制）

---

## 7. 实施优先级

### P0（MVP）

- CLI: `multiverse start` 命令
- Core: 配置管理、Template 管理、Verse 管理、容器管理
- 支持 claude-code agent
- 基本的文件系统存储

### P1（GUI 基础）

- GUI: 配置管理模块
- GUI: Template 管理模块
- Monaco Editor 集成

### P2（运行时监控）

- OTel 数据采集
- GUI: Run 监控模块
- 实时日志查看

### P3（数据分析）

- GUI: Verse 管理模块
- GUI: 数据分析模块
- 性能对比图表

### P4（多 Agent 支持）

- 支持 codex、opencode 等
- Agent 切换界面

---

## 8. 成功指标

### 8.1 功能完整性

- 所有 P0-P2 功能实现
- 单元测试覆盖率 > 80%
- E2E 测试覆盖核心流程

### 8.2 用户体验

- CLI 启动时间 < 2s
- GUI 启动时间 < 3s
- 容器启动时间 < 10s

### 8.3 稳定性

- 容器启动成功率 > 99%
- 配置文件损坏率 < 0.1%
- 无数据丢失

---

## 9. 风险与应对

### 9.1 Docker 依赖

**风险**：用户系统未安装 Docker

**应对**：
- CLI 启动时检测 Docker 可用性
- 提供友好的错误提示和安装指引
- 支持 Podman 等兼容工具

### 9.2 凭证注入失败

**风险**：宿主机凭证路径不标准

**应对**：
- 支持多种凭证路径检测
- 提供手动指定凭证路径的选项
- 凭证注入失败时提示用户手动登录

### 9.3 OTel 数据量过大

**风险**：长时间运行产生大量 traces

**应对**：
- OTel 数据采样
- 实时压缩和归档
- 提供数据清理工具

---

## 10. 附录

### 10.1 术语表

| 术语 | 定义 |
|------|------|
| ConfigItem | 单个配置项及其版本历史 |
| Template | 配置快照，不可变 |
| Verse | 某个 branch 上的所有运行历史 |
| Run | 一次完整的容器运行周期 |
| Session | 一次 agent 会话 |
| OTel | OpenTelemetry，遥测数据标准 |

### 10.2 参考资料

- Claude Code 文档
- OpenTelemetry 规范
- Tauri 文档
- Docker 文档
