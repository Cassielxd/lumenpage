# LumenPage

[简体中文](./README.md) | [English](./README.en.md)

快速入口：
[Lumen](./apps/lumen) | [Playground](./apps/playground) | [Collab Server](./apps/collab-server) | [Docs](./apps/docs) | [Core](./packages/core/core) | [View Canvas](./packages/engine/view-canvas) | [Extensions](./packages/extensions)

LumenPage 是一个面向分页文档场景的 `Canvas` 编辑器 monorepo。

它不是传统的 DOM 富文本编辑器封装，而是把文档模型、扩展系统、分页布局、渲染引擎和视图运行时拆成独立层，目标是支持：

- 真分页编辑
- 大文档渲染与增量分页
- TipTap 风格的扩展组织方式
- 基于 `Yjs + Hocuspocus` 的协作能力
- 面向业务块的自定义节点、渲染器和侧边能力

## 项目定位

当前仓库可以理解为三层组合：

1. `packages/lp/*`
   提供 ProseMirror 风格的数据模型、状态、变换、历史、输入规则和视图类型基础。
2. `packages/core/*` + `packages/extensions/*`
   提供编辑器核心、StarterKit、建议能力和大量业务/文本扩展。
3. `packages/engine/*`
   提供分页布局、渲染、视图运行时，以及最终的 `Canvas EditorView`。

上层应用目前主要有两个：

- `apps/playground`
  轻量演示入口，适合验证基础编辑能力和协作接入。
- `apps/lumen`
  当前主应用壳，集成了分页编辑、评论、修订、目录、协作状态等更完整的产品层能力。

另外还有：

- `apps/collab-server`
  基于 `@hocuspocus/server` 的协作服务。
- `apps/docs`
  文档站点。

## 当前特性

- Canvas 分页编辑视图
- 分层分页引擎：`layout-engine` / `render-engine` / `view-runtime` / `view-canvas`
- TipTap 风格扩展注册与组合
- 常见文本能力：标题、列表、表格、图片、链接、行内样式、任务列表等
- 业务扩展：音频、书签、文件、嵌入面板、公式、签章、模板、文本框、网页卡片等
- 评论与修订能力
- Yjs 协作文档同步
- Hocuspocus provider / server 接入
- 在线协作用户显示
- `lumen` 评论线程协作同步
- 协作评论双端 smoke 用例

## 目录结构

```txt
apps/
  collab-server/   Hocuspocus 协作服务
  docs/            文档站点
  lumen/           主应用
  playground/      演示应用

governance/        工程治理基线与预算快照
scripts/           仓库脚本与治理检查脚本

packages/
  core/
    core/          编辑器核心
    dev-tools/     开发调试工具
    link/          链接相关能力
    markdown/      Markdown 导入导出
    starter-kit/   默认扩展组合
    suggestion/    建议/触发匹配
  engine/
    layout-engine/ 分页布局引擎
    render-engine/ 渲染引擎
    view-runtime/  视图运行时
    view-canvas/   Canvas EditorView
  extensions/
    extension-*/   节点、mark、行为扩展
  lp/
    collab/
    commands/
    history/
    inputrules/
    keymap/
    model/
    state/
    transform/
    view-types/
```

`pnpm-workspace.yaml` 当前按分层后的目录组织：

```yaml
packages:
  - "apps/*"
  - "packages/core/*"
  - "packages/engine/*"
  - "packages/extensions/*"
  - "packages/lp/*"
```

## 架构关系

```txt
apps/lumen, apps/playground
        |
        v
packages/core/core + packages/core/starter-kit + packages/extensions/*
        |
        v
packages/engine/view-canvas
        |
        +--> packages/engine/layout-engine
        +--> packages/engine/render-engine
        +--> packages/engine/view-runtime
        +--> packages/lp/*
```

简化理解：

- `lp/*` 是底层模型和状态层。
- `core/core` 是编辑器壳与扩展装配层。
- `extensions/*` 是功能增量层。
- `engine/*` 是分页与 Canvas 视图层。
- `apps/*` 是最终产品层。

## 协作实现

当前协作实现已经不只是文档正文同步，还包括：

- 文档内容协作：`packages/extensions/extension-collaboration`
- 远端光标与 awareness：`packages/extensions/extension-collaboration-caret`
- 协作服务：`apps/collab-server`
- `playground` 协作接入
- `lumen` 协作接入
- `lumen` 评论线程协作同步

技术栈：

- `Yjs`
- `@hocuspocus/provider`
- `@hocuspocus/server`

### 启动协作服务

```bash
pnpm dev:collab
```

默认地址：

- WebSocket: `ws://127.0.0.1:1234`
- Health: `http://127.0.0.1:1234/health`

### 启动前端

Playground：

```bash
pnpm dev
```

Lumen：

```bash
pnpm dev:lumen
```

### 协作示例

Playground：

```txt
http://localhost:5173/?collab=1&collabDoc=demo&collabUser=Alice&locale=en-US
http://localhost:5173/?collab=1&collabDoc=demo&collabUser=Bob&locale=en-US
```

Lumen：

```txt
<lumen-dev-url>/?collab=1&collabDoc=lumen-demo&collabUser=Alice&locale=en-US
<lumen-dev-url>/?collab=1&collabDoc=lumen-demo&collabUser=Bob&locale=en-US
```

`<lumen-dev-url>` 请以 `pnpm dev:lumen` 启动后终端输出的 Vite 地址为准。

常用 query 参数：

- `collab=1`
- `collabUrl=ws://127.0.0.1:1234`
- `collabDoc=<document-name>`
- `collabField=default`
- `collabToken=<token>`
- `collabUser=<display-name>`
- `collabColor=<hex-color>`
- `locale=en-US|zh-CN`

## 开发命令

安装依赖：

```bash
pnpm install
```

常用命令：

```bash
pnpm dev              # 启动 playground
pnpm dev:lumen        # 启动 lumen
pnpm dev:collab       # 启动协作服务
pnpm docs:dev         # 启动文档站点

pnpm build            # 构建整个 workspace
pnpm build:lumen      # 构建 lumen
pnpm build:collab     # build/check 协作服务应用

pnpm typecheck        # 全仓类型检查
pnpm format           # 全仓格式化
pnpm format:check     # 检查格式
```

治理与增量检查：

```bash
pnpm affected:list        # 查看受影响包
pnpm typecheck:affected   # 仅对受影响包做类型检查
pnpm build:affected       # 仅构建受影响包
pnpm governance:check     # 运行分层/预算/同步等治理检查
pnpm docs:check:lumen-menu
```

与 `lumen` 相关的验证：

```bash
pnpm -C apps/lumen test:e2e
pnpm -C apps/lumen test:e2e:collab
```

## 关键包说明

### `packages/core/*`

- `core`
  编辑器核心、扩展机制、命令装配、Schema 生成。
- `starter-kit`
  默认文本扩展组合。
- `markdown`
  Markdown 导入导出桥接。
- `suggestion`
  mention / slash command 一类触发建议基础能力。
- `link`
  链接解析与导航策略。
- `dev-tools`
  开发调试工具。

### `packages/engine/*`

- `layout-engine`
  分页、断页、续页、页面复用、增量布局。
- `render-engine`
  节点/mark 到布局片段与绘制计划的渲染层。
- `view-runtime`
  选择、命中、坐标、虚拟化等视图运行时能力。
- `view-canvas`
  最终的 Canvas 编辑视图与输入事件接线。

### `packages/extensions/*`

扩展分为几类：

- 基础文本扩展
  例如 `paragraph`、`heading`、`bold`、`italic`、`link`、`table`。
- 行为扩展
  例如 `bubble-menu`、`drag-handle`、`slash-command`、`mention`、`undo-redo`。
- 协作扩展
  `extension-collaboration`、`extension-collaboration-caret`、`extension-comment`。
- 业务节点扩展
  `audio`、`bookmark`、`embed-panel`、`file`、`math`、`signature`、`template`、`web-page` 等。

### `packages/lp/*`

这是整个编辑器栈的底层能力集合，对应模型、状态、事务、命令、历史、输入规则和视图类型。

## 工程治理

仓库当前除了编辑器实现本身，还引入了几类持续治理约束：

- 分层边界检查，避免 `core / engine / extensions / lp` 再次耦合回扁平结构。
- runtime 同步检查，确保 `view-runtime` 与上层接线保持一致。
- 构建预算与 smoke gate，防止体积和关键链路在演进中失控。
- 文档菜单同步检查，避免 `apps/docs` 与 `lumen` 功能清单脱节。

这些基线文件位于 `governance/`，执行入口主要在根 `package.json` 的 `governance:*` 脚本里。

## 当前建议阅读顺序

如果你是第一次进入仓库，建议按这个顺序看：

1. `apps/lumen`
2. `apps/playground`
3. `packages/core/core`
4. `packages/core/starter-kit`
5. `packages/extensions/extension-*`
6. `packages/engine/view-canvas`
7. `packages/engine/layout-engine`
8. `packages/lp/*`

## 当前状态

目前仓库已经完成这些关键重构与接入：

- `packages/` 从扁平结构重组为 `core / engine / extensions / lp`
- `playground` 与 `lumen` 都已接入 Hocuspocus 协作
- `lumen` 在线协作用户状态已经接入 UI
- `lumen` 评论线程已进入协作链路
- 孤儿评论线程会自动清理
- 已有协作评论 smoke 用例覆盖基础双端同步

仍需继续完善的方向：

- 评论消息级编辑/删除
- 更完整的鉴权与会话管理
- 服务端外部存储与多实例扩展
- 更细的协作异常恢复测试
- 大 chunk 继续拆分

## 相关入口

- [apps/lumen](./apps/lumen)
- [apps/playground](./apps/playground)
- [apps/collab-server](./apps/collab-server)
- [apps/docs](./apps/docs)
- [packages/core/core](./packages/core/core)
- [packages/engine/view-canvas](./packages/engine/view-canvas)
- [packages/extensions](./packages/extensions)
