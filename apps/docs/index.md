---
layout: home

hero:
  name: LumenPage
  text: 面向分页文档场景的 Canvas 编辑器
  tagline: 对标 Google Docs 方向的文档底座，强调分页编辑、插件扩展、产品壳装配和可持续演进。
  actions:
    - theme: brand
      text: 从 Lumen 入口开始
      link: /guide/lumen-entry
    - theme: alt
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看应用 API
      link: /api/lumen-app
    - theme: alt
      text: 体验 Lumen Demo
      link: /demo/lumen-app

features:
  - title: Pagination-first
    details: 编辑阶段直接分页，布局、渲染、视图运行时和产品壳围绕同一套页面模型工作。
  - title: Plugin-first
    details: 节点、行为、协作、审阅、AI 和业务块都通过 extension 组织，而不是堆进应用层。
  - title: Product Shell
    details: Lumen 不只是示例页，已经具备评论、修订、协作、AI、标注和交互式标尺等产品能力。
  - title: Replaceable Services
    details: 协作和 AI 服务通过 collab-server 接入，前端壳、协作协议和模型供应商保持解耦。
---

## LumenPage 现在是什么

LumenPage 不是一个单纯的 `contenteditable` 富文本编辑器，而是一套围绕分页文档构建的编辑系统：

- `packages/lp/*` 负责模型、状态、事务、命令、历史和输入规则
- `packages/core/*` 负责 Editor 壳、StarterKit 和编辑器抽象
- `packages/engine/*` 负责分页布局、Canvas 渲染和视图运行时
- `packages/extensions/*` 负责节点、交互、协作、AI 和业务扩展
- `apps/lumen` 负责产品壳、工具栏、右侧工作区、标注、协作和 AI 接入

## 当前产品能力

Lumen 已经不是最小 demo，而是当前项目最接近真实文档产品的一层：

- 评论、修订、目录、协作状态和 AI 助手
- 文档标注工作区，支持涂写、高亮、直线、框选、擦除
- 交互式文档标尺，支持水平和垂直页边距拖拽
- 浮动侧边操作和右侧工作区面板
- `vue-i18n` 统一国际化
- `collab-server` 统一承接 Yjs / Hocuspocus 和 AI 代理

## 为什么推荐先看 `apps/lumen`

如果你是第一次进入这个仓库，不要先从底层 layout engine 开始。  
优先从 `apps/lumen` 看，你能最快理解这几个最关键的问题：

- 应用壳怎么装配 `Editor` 和 `CanvasEditorView`
- 页面配置、协作、AI、标注、标尺放在什么层
- 扩展清单如何从 `documentExtensions.ts` 进入产品
- 右侧工作区、浮动动作和统计信息如何围绕编辑器状态工作

## 阅读顺序

### 产品层

- [从 Lumen 入口开始](/guide/lumen-entry)
- [Lumen 运行时配置](/guide/lumen-config)
- [Lumen 扩展装配](/guide/lumen-extensions)
- [扩展与分页能力](/guide/extensions-and-pagination)

### API

- [Lumen App 入口 API](/api/lumen-app)
- [Lumen 配置 API](/api/lumen-config)
- [Lumen 扩展清单 API](/api/lumen-extensions)

### 示例

- [Lumen App Demo](/demo/lumen-app)
- [Basic Editor Demo](/demo/basic-editor)
- [Slash Command Demo](/demo/slash-command)
