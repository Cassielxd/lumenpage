# LumenPage

[简体中文](./README.md) | [English](./README.en.md)

快速入口：
[Lumen](./apps/lumen) | [Playground](./apps/playground) | [Collab Server](./apps/collab-server) | [Docs](./apps/docs) | [Core](./packages/core/core) | [View Canvas](./packages/engine/view-canvas) | [Extensions](./packages/extensions)

LumenPage 是一个面向分页文档场景的编辑器 monorepo。  
它不是“富文本输入框 + 一层 UI 包装”，而是在用工程化方式搭建一套可持续演进的在线文档底座：文档模型、事务系统、分页布局、Canvas 渲染、实时协作、评论、修订、AI、导入导出和产品层应用都被拆成了清晰分层。

## 项目定位

LumenPage 的方向是对标 Google Docs 这一类在线文档产品，但重点不在 UI 复刻，而在能力边界和架构设计。

| 关注点 | LumenPage 的目标 |
| --- | --- |
| 协作 | 对标多人实时协作，而不是单机编辑器 |
| 文档形态 | 对标长文档、真分页、打印友好，而不是纯滚动式 DOM 编辑 |
| 产品能力 | 对标评论、修订、目录、分享、AI 等完整文档工作流 |
| 架构方式 | 对标可长期演进的文档平台，而不是把功能硬编码到一个应用里 |

换句话说，这个仓库想解决的不是“做一个编辑器页面”，而是“为 Google Docs 方向的产品能力建立可扩展底座”。

## 设计思想

### 1. Document-first，而不是 DOM-first

LumenPage 并不是 `contenteditable + DOM patch` 方案。  
它先组织文档模型、状态、事务、命令和扩展，再把这些能力映射到分页布局和 Canvas 视图。

这样做的收益是：

- 文档结构稳定，功能边界更清晰
- 编辑行为更容易抽象成命令和扩展
- 评论、修订、协作、导出、AI 可以围绕同一份文档状态工作

### 2. Pagination-first，而不是把分页当打印附属品

很多 Web 编辑器把分页看成导出或打印阶段的附加效果。  
LumenPage 把分页直接放进主链路，目标是支撑：

- 真分页编辑
- 大文档的增量布局
- 页级渲染与复用
- 页眉、页脚、水印、页码、页面方向等能力协同

### 3. Plugin-first，而不是功能堆砌

项目里大量能力都通过 `packages/extensions/*` 组织，包括：

- 基础节点和 marks
- 评论、修订、协作、拖拽、气泡菜单、斜杠菜单
- 音频、附件、书签、模板、签章、网页嵌入等业务节点
- AI 插件和产品层 AI 接入

这意味着新能力优先通过插件进入系统，而不是反复修改编辑器核心。

### 4. Engine 和 Product Shell 解耦

仓库不是“一层应用 + 一堆组件”的结构，而是把引擎层和产品层分开：

- `packages/lp/*`：模型、状态、事务、命令、历史、输入规则、视图类型
- `packages/core/*`：编辑器壳、StarterKit、Markdown、Suggestion、Link 等核心能力
- `packages/engine/*`：分页布局、渲染、命中测试、Canvas 运行时
- `packages/extensions/*`：可插拔功能和业务扩展
- `apps/*`：最终产品壳、演示入口和服务接入

这套边界更适合长期演进，也更适合同时支持 Playground、Lumen 和后续其他产品形态。

### 5. 协作与服务端能力保持可替换

协作、AI、健康检查等服务能力并没有写死在前端应用里。  
当前通过 `apps/collab-server` 承接：

- Hocuspocus / Yjs 协作服务
- 健康检查
- AI 请求代理

这让前端产品层、协作协议和模型供应商保持松耦合。

## 技术栈

| 层级 | 技术选择 | 作用 |
| --- | --- | --- |
| 应用层 | `Vue 3` + `Vite` + `TypeScript` | 搭建产品壳、开发体验和类型安全 |
| UI 层 | `TDesign Vue Next` | 提供应用级组件体系 |
| 国际化 | `vue-i18n` | 统一 Lumen 应用层文案和语言切换 |
| 编辑器核心 | `lumenpage-*` 自研包 | 文档模型、事务、命令、扩展和视图抽象 |
| 分页与渲染 | `Canvas` + `layout-engine` + `render-engine` + `view-runtime` | 真分页编辑、布局计算和视图运行时 |
| 协作 | `Yjs` + `@hocuspocus/provider` + `@hocuspocus/server` | 文档同步、远端光标和协作会话 |
| 导入导出 | `mammoth` + `docx` | Word 导入与导出链路 |
| 工程化 | `pnpm workspace` + `Prettier` + `Playwright` + 自定义治理脚本 | 统一构建、校验、E2E 和仓库治理 |

## 架构总览

```txt
apps/lumen                apps/playground                apps/docs
      \                         |                           /
       \                        |                          /
        +---- packages/core/core + starter-kit + extensions/* ----+
                                  |                                |
                                  v                                |
                        packages/engine/view-canvas                |
                                  |                                |
                 +----------------+----------------+               |
                 |                                 |               |
                 v                                 v               |
  packages/engine/layout-engine      packages/engine/render-engine |
                 |                                 |               |
                 +----------- packages/engine/view-runtime --------+
                                  |
                                  v
                             packages/lp/*

apps/collab-server
  |- ws://...   协作同步
  |- /health    健康检查
  |- /ai/*      AI 代理
```

可以把它理解成五层：

1. `packages/lp/*`
底层能力层，负责模型、状态、事务、命令、历史、输入规则和视图类型。

2. `packages/core/*`
编辑器核心层，负责编辑器壳、StarterKit、Markdown、Suggestion、Link 等基础能力。

3. `packages/extensions/*`
扩展层，负责节点、marks、行为扩展、协作扩展和业务能力扩展。

4. `packages/engine/*`
分页与视图引擎层，负责布局、渲染、命中测试、坐标映射和 Canvas 运行时。

5. `apps/*`
产品层和演示层，负责最终交互、产品功能、国际化以及服务接入。

## 插件与扩展能力

扩展能力是这个仓库最重要的设计点之一。新增功能时，优先判断它属于哪一层：

| 扩展类型 | 典型位置 | 说明 |
| --- | --- | --- |
| 节点 / Mark 扩展 | `packages/extensions/extension-*` | 表格、图片、评论标记、修订标记、模板等 |
| 行为扩展 | `packages/extensions/extension-*` | 拖拽、气泡菜单、斜杠菜单、协作光标等 |
| 业务扩展 | `packages/extensions/extension-*` | 音频、附件、签章、网页嵌入、AI 等 |
| 组合入口 | `packages/core/starter-kit`、`apps/lumen/src/editor/documentExtensions.ts` | 决定应用实际装配哪些扩展 |
| 产品适配 | `apps/lumen`、`apps/playground` | 面板、菜单、工具栏、对话框、服务调用 |

以 AI 为例，当前链路是：

1. `packages/extensions/extension-ai`
负责编辑器侧能力、上下文提取和结果应用。

2. `apps/lumen`
负责 AI 面板、供应商配置、i18n、用户交互。

3. `apps/collab-server`
负责模型请求代理，避免把 key 暴露在前端。

这条链路说明：产品功能可以很复杂，但核心编辑器并不需要直接依赖具体供应商或某一个 UI 组件。

## 当前扩展清单

以下清单直接对应 [packages/extensions](./packages/extensions) 当前目录，后续新增扩展时，这里也应该同步维护。

### 基础文档与文本

- [extension-document](./packages/extensions/extension-document)
- [extension-paragraph](./packages/extensions/extension-paragraph)
- [extension-text](./packages/extensions/extension-text)
- [extension-heading](./packages/extensions/extension-heading)
- [extension-blockquote](./packages/extensions/extension-blockquote)
- [extension-bullet-list](./packages/extensions/extension-bullet-list)
- [extension-ordered-list](./packages/extensions/extension-ordered-list)
- [extension-list-item](./packages/extensions/extension-list-item)
- [extension-task-list](./packages/extensions/extension-task-list)
- [extension-task-item](./packages/extensions/extension-task-item)
- [extension-code](./packages/extensions/extension-code)
- [extension-code-block](./packages/extensions/extension-code-block)
- [extension-hard-break](./packages/extensions/extension-hard-break)
- [extension-horizontal-rule](./packages/extensions/extension-horizontal-rule)
- [extension-bold](./packages/extensions/extension-bold)
- [extension-italic](./packages/extensions/extension-italic)
- [extension-strike](./packages/extensions/extension-strike)
- [extension-underline](./packages/extensions/extension-underline)
- [extension-subscript](./packages/extensions/extension-subscript)
- [extension-superscript](./packages/extensions/extension-superscript)
- [extension-text-style](./packages/extensions/extension-text-style)
- [extension-smart-input-rules](./packages/extensions/extension-smart-input-rules)
- [extension-undo-redo](./packages/extensions/extension-undo-redo)

### 结构、布局与页面能力

- [extension-columns](./packages/extensions/extension-columns)
- [extension-table](./packages/extensions/extension-table)
- [extension-page-break](./packages/extensions/extension-page-break)
- [extension-option-box](./packages/extensions/extension-option-box)
- [extension-callout](./packages/extensions/extension-callout)

### 协作、审阅与编辑交互

- [extension-active-block](./packages/extensions/extension-active-block)
- [extension-ai](./packages/extensions/extension-ai)
- [extension-bubble-menu](./packages/extensions/extension-bubble-menu)
- [extension-changeset](./packages/extensions/extension-changeset)
- [extension-collaboration](./packages/extensions/extension-collaboration)
- [extension-collaboration-caret](./packages/extensions/extension-collaboration-caret)
- [extension-comment](./packages/extensions/extension-comment)
- [extension-drag-handle](./packages/extensions/extension-drag-handle)
- [extension-mention](./packages/extensions/extension-mention)
- [extension-popup](./packages/extensions/extension-popup)
- [extension-slash-command](./packages/extensions/extension-slash-command)
- [extension-tag](./packages/extensions/extension-tag)
- [extension-track-change](./packages/extensions/extension-track-change)

### 业务节点与富媒体

- [extension-audio](./packages/extensions/extension-audio)
- [extension-bookmark](./packages/extensions/extension-bookmark)
- [extension-embed-panel](./packages/extensions/extension-embed-panel)
- [extension-file](./packages/extensions/extension-file)
- [extension-image](./packages/extensions/extension-image)
- [extension-link](./packages/extensions/extension-link)
- [extension-math](./packages/extensions/extension-math)
- [extension-seal](./packages/extensions/extension-seal)
- [extension-signature](./packages/extensions/extension-signature)
- [extension-template](./packages/extensions/extension-template)
- [extension-text-box](./packages/extensions/extension-text-box)
- [extension-video](./packages/extensions/extension-video)
- [extension-web-page](./packages/extensions/extension-web-page)

### 基础设施与内部支撑

- [extension-block-id](./packages/extensions/extension-block-id)

## 核心能力

当前仓库已经覆盖的能力大致包括：

- 分页 Canvas 编辑视图
- 文档模型、事务、命令、历史、输入规则、快捷键
- 标题、列表、表格、图片、视频、链接、下划线、上下标、文本样式
- 评论和评论线程同步
- 修订 / Track Changes
- Yjs 协作和远端光标
- 目录、页面设置、页眉页脚、水印、页面背景
- 音频、附件、书签、模板、签章、网页嵌入、公式、提示块等业务节点
- AI 助手插件和本地协作服务代理
- Markdown / Word / HTML / 文本等导入导出链路

## 仓库结构

```txt
apps/
  collab-server/   协作服务和 AI 代理服务
  docs/            文档站点
  lumen/           主应用，最接近真实产品壳
  playground/      轻量演示入口
  shared/          应用层共享代码

packages/
  core/
    core/          编辑器核心
    dev-tools/     调试工具
    link/          链接能力
    markdown/      Markdown 导入导出
    starter-kit/   默认扩展组合
    suggestion/    建议与触发能力
  engine/
    layout-engine/ 分页布局引擎
    render-engine/ 渲染引擎
    view-runtime/  视图运行时
    view-canvas/   Canvas EditorView
  extensions/
    extension-*/   节点、mark、行为、协作和业务扩展
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

governance/        工程治理规则和预算基线
scripts/           仓库脚本
```

## 应用层说明

### `apps/lumen`

这是当前主应用，也是最接近“在线文档产品壳”的入口。  
它整合了：

- 分页编辑
- 评论和评论线程
- 修订面板
- 协作状态展示
- AI 助手
- 页面设置
- 国际化

如果你想理解项目的产品方向，优先从这里开始。

### `apps/playground`

这是更轻的演示入口，适合验证：

- 编辑器基础能力
- 扩展装配
- 协作接入
- 引擎层行为

如果你想看最小可运行链路，优先从这里开始。

### `apps/collab-server`

这是协作服务，同时承接：

- Hocuspocus / Yjs 文档协作
- 健康检查
- AI 请求代理

默认地址：

- WebSocket：`ws://127.0.0.1:1234`
- Health：`http://127.0.0.1:1234/health`

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动协作服务

```bash
pnpm dev:collab
```

### 启动主应用

```bash
pnpm dev:lumen
```

### 启动 Playground

```bash
pnpm dev
```

### 启动文档站点

```bash
pnpm docs:dev
```

## 常用命令

```bash
pnpm dev                     # 启动 playground
pnpm dev:lumen              # 启动 lumen
pnpm dev:collab             # 启动协作服务
pnpm docs:dev               # 启动 docs

pnpm build                  # 构建整个 workspace
pnpm build:lumen            # 构建 lumen
pnpm build:collab           # 检查 collab-server

pnpm typecheck              # 全仓类型检查
pnpm format                 # 全仓格式化
pnpm format:check           # 检查格式

pnpm affected:list          # 查看受影响包
pnpm typecheck:affected     # 仅检查受影响包
pnpm build:affected         # 仅构建受影响包
pnpm governance:check       # 运行治理检查

pnpm test:lumen:e2e         # 运行 lumen E2E
pnpm -C apps/lumen test:e2e:collab
```

## 协作调试示例

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

常用 query 参数：

- `collab=1`
- `collabUrl=ws://127.0.0.1:1234`
- `collabDoc=<document-name>`
- `collabField=default`
- `collabToken=<token>`
- `collabUser=<display-name>`
- `collabColor=<hex-color>`
- `locale=en-US|zh-CN`

## 为什么这套架构适合继续对标 Google Docs

如果目标只是做一个简单编辑器，很多功能都可以直接堆到应用层。  
但如果目标是持续向 Google Docs 这类产品靠拢，底层必须先满足几个条件：

- 文档模型独立于 UI
- 分页与渲染独立于业务功能
- 协作能力独立于应用壳
- 评论、修订、AI、导入导出围绕同一份文档状态工作
- 业务节点和产品能力可以通过插件持续接入

LumenPage 现在的分层，正是围绕这些条件搭建的。  
它并不意味着项目已经达到 Google Docs 的完整深度，但意味着后续继续演进时，不需要先推翻底层结构。

## 当前状态

已经完成的基础建设：

- monorepo 分层已经建立
- `playground` 和 `lumen` 双入口已经可运行
- 分页 Canvas 编辑链路已经打通
- Yjs + Hocuspocus 协作已经接入
- 评论和修订已经进入产品层
- AI 插件已经进入 `lumen`
- `lumen` 的国际化已经统一到 `vue-i18n`

仍然值得持续推进的方向：

- 更强的分页性能和大文档优化
- 更完整的权限、会话和服务端存储
- 更成熟的导入导出兼容性
- 更细粒度的协作恢复和冲突处理
- 更完整的产品级 AI 工作流

## 建议阅读顺序

如果你是第一次进入仓库，推荐按这个顺序阅读：

1. [apps/lumen](./apps/lumen)
2. [apps/playground](./apps/playground)
3. [packages/core/core](./packages/core/core)
4. [packages/core/starter-kit](./packages/core/starter-kit)
5. [packages/extensions](./packages/extensions)
6. [packages/engine/view-canvas](./packages/engine/view-canvas)
7. [packages/engine/layout-engine](./packages/engine/layout-engine)
8. [packages/lp](./packages/lp)

## 相关入口

- [apps/lumen](./apps/lumen)
- [apps/playground](./apps/playground)
- [apps/collab-server](./apps/collab-server)
- [apps/docs](./apps/docs)
- [packages/core/core](./packages/core/core)
- [packages/engine/view-canvas](./packages/engine/view-canvas)
- [packages/extensions](./packages/extensions)

## 联系方式

- 邮箱：348040933@qq.com
