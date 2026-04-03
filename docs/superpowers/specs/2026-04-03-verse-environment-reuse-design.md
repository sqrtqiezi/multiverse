# Verse Environment Reuse Design

## 背景

当前实现中，`Verse` 仅承担当前 branch 的 run 历史记录职责。`multiverse start` 每次都会创建一个新的 Docker 容器，并在退出后删除容器。由于 claude code 的执行环境没有被建模为 `Verse` 的一部分，也没有挂载到可持久化的宿主机目录，因此同一个项目、同一个 branch 再次执行 `start` 时，claude code 会重新进入初始化流程。

这与目标语义不一致。目标语义是：`Verse` 是项目内某个 branch 的唯一执行环境聚合根。首次 `start` 创建 verse 并初始化 claude code 执行环境；后续只要仍在同一个项目的同一个 branch 上执行 `start`，就必须复用该 verse 绑定的 claude code 环境。容器是否已销毁不影响复用。

## 目标

- 将 `Verse` 从“branch 级 run 日志”修正为“branch 级可复用执行环境聚合根”
- 首次 `start` 为当前项目 + branch 创建 verse 和对应的 claude code 持久化环境目录
- 后续在同一项目 + branch 上再次 `start` 时复用同一环境目录，不重新初始化 claude code
- 保留现有 `runs[]` 审计信息能力
- 对已存在的旧版 verse 文件做兼容迁移，不丢失历史 run 记录

## 非目标

- 不实现 verse fork / archive / lineage
- 不实现 Docker volume 持久化方案
- 不实现“复用正在运行的容器”或 attach 到旧容器
- 不修改 GUI 行为

## 领域规则

### Verse 身份

- `Verse` 由“项目根目录 + branch 名”唯一确定
- 同一个项目内，同一个 branch 只允许存在一个活动 verse
- branch 的工作树内容变化不会创建新 verse
- 多次 `start`、容器销毁、容器重建都不会创建新 verse

### 首次启动

- 在某项目的某 branch 第一次执行 `multiverse start` 时：
  - 创建 verse 元数据文件
  - 为该 verse 分配宿主机持久化环境目录
  - 启动 claude code
  - claude code 在该环境目录中完成初始化

### 后续启动

- 在同项目同 branch 再次执行 `multiverse start` 时：
  - 读取已有 verse
  - 复用 verse 绑定的宿主机环境目录
  - 启动新的容器，但挂载相同的环境目录
  - claude code 不应再次进入初始化流程

### 容器语义

- 容器只是一次 `start` 的运行载体，不是 verse 身份的一部分
- 即使前一次 `start` 的容器已被删除，只要 verse 绑定的环境目录仍在，后续 `start` 必须继续复用该环境

### Detached HEAD

- 当仓库处于 detached HEAD 时，branch 解析结果采用 `detached-<shortSha>`
- 该名称像普通 branch 一样参与 verse 创建与复用

## 方案选择

### 方案 A：Verse 绑定宿主机持久化环境目录

为每个 verse 分配固定宿主机目录，并在容器启动时挂载到 claude code 的状态目录。

优点：

- 与“环境仅和 verse 关联”完全一致
- 容器销毁不影响环境复用
- 便于调试、备份、迁移和测试
- 与当前文件型 verse 元数据实现兼容

缺点：

- 需要扩展 verse 元数据结构
- 需要明确 claude code 状态目录映射策略

### 方案 B：Docker volume

为每个 verse 分配固定 Docker volume。

优点：

- 容器生态内聚

缺点：

- verse 元数据和真实环境分散在不同存储介质中
- 调试、备份、迁移和测试复杂度更高
- 不利于当前仓库以文件为中心的实现方式

### 方案 C：复用持久容器

保留容器并在后续 `start` attach 到既有容器。

优点：

- 可以延续同一进程态

缺点：

- 与“容器被销毁后仍不重新初始化”的目标冲突
- 增加容器生命周期管理复杂度

### 结论

采用方案 A。`Verse` 绑定宿主机持久化环境目录，容器仅作为临时执行载体。

## 数据模型修正

当前类型：

```ts
interface Verse {
  schemaVersion: 1;
  id: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
  runs: RunRecord[];
}
```

修正后：

```ts
interface VerseEnvironment {
  hostPath: string;
  containerPath: string;
  initializedAt: string;
}

interface Verse {
  schemaVersion: 2;
  id: string;
  branch: string;
  projectRoot: string;
  environment: VerseEnvironment;
  createdAt: string;
  updatedAt: string;
  runs: RunRecord[];
}
```

字段语义：

- `projectRoot`：verse 所属项目根目录，用于显式表达 verse 身份边界
- `environment.hostPath`：verse 专属宿主机环境目录
- `environment.containerPath`：容器内 claude code 状态目录
- `environment.initializedAt`：该环境首次分配时间，不随每次 `start` 变化

`runs[]` 保留原有职责，仅用于记录每次 `start` 的运行历史，不再承担环境复用语义。

## 存储布局

### Verse 元数据文件

- 路径：`.multiverse/verses/<sanitized-branch>__<hash>.json`
- 延续当前路径规则，避免破坏现有查找逻辑

### Verse 环境目录

- 路径：`.multiverse/verse-envs/<verse-id>/claude-home/`

选择该布局的原因：

- 将小型元数据文件与运行态目录分离
- 避免在 `.multiverse/verses/` 下混入大量状态文件
- 使用 `verse-id` 而不是 branch 名，避免 branch 重命名或字符清洗导致目录冲突

## 启动流程修正

### 当前错误流程

当前 `start` 流程的问题有两个：

1. 每次都新建容器，且 `autoRemove: true`
2. 挂载中没有 verse 专属环境目录，只有项目目录和凭证文件

因此 claude code 的初始化状态没有持久化介质。

### 修正后的流程

1. 解析当前 branch
2. `VerseService.ensureVerseForCurrentBranch(cwd)` 读取或创建 verse
3. 若为新 verse，则分配宿主机环境目录并写回 verse 元数据
4. 构造容器配置时：
   - 挂载项目目录到 `/workspace`
   - 挂载 verse 环境目录到 claude code 状态目录
   - 按需要注入凭证
5. 启动容器并运行 claude code
6. 记录本次 run 的开始信息
7. 等待容器退出
8. 记录本次 run 的结束信息

关键点：

- 新容器可以继续创建
- 新容器必须挂载旧 verse 的同一环境目录
- 只要环境目录保留，claude code 就不会重新初始化

## 凭证与状态目录策略

当前实现将 `~/.claude/credentials.json` 和 `~/.claude/.credentials` 只读挂入容器。这种方式只覆盖认证，不覆盖 claude code 的完整初始化状态。

修正后不应继续把宿主机 `~/.claude` 整体直接共享给所有 verse，因为那会让不同项目/branch 共享环境，违背“执行环境仅和 verse 关联”的要求。

建议策略：

- 继续从宿主机发现凭证
- 但容器中的 claude code 主状态目录必须是 verse 专属挂载目录
- 如 claude code 需要从凭证文件启动，可在容器启动前将必要凭证同步到 verse 环境目录，或保持最小只读凭证挂载，同时确保其余运行态文件写入 verse 环境目录

实现时需要先确认 claude code 实际写入初始化状态的容器内目录，然后将 `environment.containerPath` 指向该目录。只有这个目录被 verse 专属宿主机路径承载，才能保证“不重复初始化”的语义成立。

## 模块职责调整

### `packages/types/src/verse.ts`

- 扩展 `Verse` 类型到 schema v2
- 新增 `VerseEnvironment`
- 保留 `RunRecord`

### `packages/core/src/verse/verse-repository.ts`

- 继续负责 verse 元数据的原子读写
- 首次创建 verse 时分配环境目录路径
- 支持读取旧版 schema v1，并在写入时升级为 schema v2

### `packages/core/src/verse/verse-service.ts`

- 从“仅确保 branch verse 存在”升级为“解析 branch 对应 verse 及其环境”
- 对 CLI 返回：
  - verse
  - environment host path
  - 是否首次创建

### `packages/cli/src/commands/start.ts`

- 在容器卷挂载中加入 verse 专属环境目录
- 继续记录 run 开始/结束信息
- 不需要复用容器 ID，也不需要保持容器常驻

### `packages/core/src/docker/credential-resolver.ts`

- 保持凭证发现职责
- 避免把宿主机全局 `~/.claude` 作为共享状态目录暴露给所有 verse

## 向后兼容与迁移

当前已有 verse 文件是旧结构，只包含 `schemaVersion: 1`、`branch`、`runs[]` 等字段。

迁移策略：

1. 读取 verse 文件时兼容 schema v1
2. 若缺少 `projectRoot` 或 `environment`，则在下一次命中该 verse 的 `start` 中自动补全：
   - `projectRoot`
   - `environment.hostPath`
   - `environment.containerPath`
   - `environment.initializedAt`
3. 将 verse 落盘为 schema v2
4. 原有 `runs[]` 全部保留

这样不需要单独的迁移命令，也不会要求用户手工清理旧数据。

## 测试设计

按照仓库约束，先补 Gherkin e2e，再拆单元测试。

### E2E 场景

1. 首次 `start` 创建 verse 和环境目录
   - 断言 verse 文件存在
   - 断言 `environment.hostPath` 存在
   - 断言首次启动后环境目录中出现初始化产物

2. 同 branch 第二次 `start` 复用同一环境目录
   - 断言 `verse.id` 不变
   - 断言 `environment.hostPath` 不变
   - 断言 `runs.length` 增加
   - 断言不存在重新初始化迹象

3. 容器销毁后再次 `start` 仍复用环境
   - 断言删除前一次容器后仍使用同一 `environment.hostPath`
   - 断言不存在重新初始化迹象

4. 不同 branch 使用不同 verse 环境
   - 断言两个 branch 的 `verse.id` 不同
   - 断言两个 branch 的 `environment.hostPath` 不同

### 单元测试

- `verse-service.test.ts`
  - 首次创建 verse 返回环境目录
  - 同 branch 复用既有 verse
  - detached HEAD 使用 `detached-<shortSha>`

- `verse-repository.test.ts`
  - schema v2 原子写入
  - schema v1 自动升级
  - 环境目录字段持久化正确

- `start` 命令相关测试
  - 构造容器配置时包含 verse 环境挂载
  - 第二次启动不会更换环境路径

## 错误处理

新增或明确以下失败模式：

- verse 环境目录无法创建
- verse 元数据存在但环境目录缺失
- 旧版 verse 自动升级失败
- claude code 状态目录映射错误导致环境未复用

处理原则：

- 元数据损坏：沿用 `VerseCorruptedError`
- 环境目录缺失：尝试自动重建目录，但不重建 verse ID
- 无法确认 claude code 状态目录：阻止发布该功能，先补清楚映射策略

## 实施顺序

1. 新增/修改 e2e feature，明确环境复用行为
2. 扩展 `Verse` 类型与 schema 兼容读取
3. 修改 `VerseRepository` 和 `VerseService`
4. 修改 `start` 命令注入 verse 环境挂载
5. 补充/调整单元测试
6. 跑通受影响测试并验证旧 verse 自动升级

## 成功标准

- 同项目同 branch 首次 `start` 后创建 verse 和环境目录
- 后续 `start` 即使容器被删除，claude code 仍复用该环境
- 不同 branch 不共享 claude code 初始化状态
- 旧版 verse 文件可自动升级，历史 run 不丢失
- run 记录能力继续可用
