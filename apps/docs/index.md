---
layout: home

hero:
  name: Lumenpage
  text: 面向文档场景的 Canvas 分页编辑器
  tagline: 为长文档、分页页面和复杂业务块而设计，在编辑阶段直接得到接近最终结果的页面体验。
  actions:
    - theme: brand
      text: 了解 Lumenpage
      link: /guide/getting-started
    - theme: alt
      text: 查看 API
      link: /api/core
    - theme: alt
      text: Lumen 应用入口
      link: /guide/lumen-entry
    - theme: alt
      text: 体验 Demo
      link: /demo/lumen-app

features:
  - title: 编辑时即分页
    details: 编辑阶段直接看到分页结果，适合文档和页面类场景。
  - title: API 向 tiptap 靠拢
    details: Editor、Extension、Node、Mark 的使用方式尽量贴近 tiptap。
  - title: Canvas 渲染可控
    details: 布局、渲染、视图分层，适合高保真页面和导出场景。
  - title: 基础与业务分层
    details: 核心层保留基础能力，业务块留在 extension 包，边界清晰。
---

## 为什么是 Lumenpage

Lumenpage 不是一个只会渲染 HTML 的普通富文本编辑器，而是一套面向文档场景的编辑系统。

- 编辑阶段就具备布局和分页能力
- 状态模型保持 ProseMirror 风格，便于理解事务、选择区和 schema
- 上层 API 尽量向 tiptap 对齐，降低迁移和上手成本
- 基础能力和业务能力分层，适合长期演进

## 适合什么场景

- 长文档编辑
- 分页页面和公文类编辑
- 表格、图片、视频、附件、签名等复杂块混排
- 需要更强渲染控制和导出能力的编辑器产品

## 适合谁使用

- tiptap 用户：希望保留扩展心智模型，同时获得分页和 Canvas 视图能力
- 编辑器产品开发者：需要自己控制工具栏、块能力、导出和页面壳
- 文档系统团队：需要长文档、分页页面、复杂业务块和更稳定的渲染边界

## 典型能力

<div class="lp-capability-grid">
  <div class="lp-capability-card">
    <strong>分页编辑</strong>
    <span>在编辑过程中直接看到页面切分。</span>
  </div>
  <div class="lp-capability-card">
    <strong>Slash Command</strong>
    <span>新段落输入 <code>/</code> 快速插入块。</span>
  </div>
  <div class="lp-capability-card">
    <strong>Mention</strong>
    <span>和输入建议系统联动的实体插入。</span>
  </div>
  <div class="lp-capability-card">
    <strong>Bubble Menu</strong>
    <span>选区浮动工具条。</span>
  </div>
  <div class="lp-capability-card">
    <strong>表格和复杂块</strong>
    <span>表格、图片、视频、附件、书签、网页卡片等混排。</span>
  </div>
  <div class="lp-capability-card">
    <strong>签名与导出</strong>
    <span>签名块、Word 导入、可编辑 Word 导出。</span>
  </div>
</div>

## 核心分层

- `packages/lp/*`：模型、状态、变换、历史、命令等底层能力
- `packages/core`：Editor、Extension、Node、Mark、事件与 schema 组装
- `packages/layout-engine`：断行、布局、分页
- `packages/render-engine`：基础默认 renderer 和 mark adapter
- `packages/view-canvas`：Canvas 视图、输入、选区、光标、 node view 运行时
- `packages/extension-*`：业务块和交互扩展

## 架构示意

<div class="lp-arch-grid">
  <div class="lp-arch-card">
    <strong>apps/lumen</strong>
    <span>应用壳、工具栏、页面布局、业务接入入口</span>
  </div>
  <div class="lp-arch-card">
    <strong>packages/core</strong>
    <span>Editor、Extension、Node、Mark、事件与 schema 组装</span>
  </div>
  <div class="lp-arch-card">
    <strong>packages/lp/*</strong>
    <span>模型、状态、变换、历史、命令等底层能力</span>
  </div>
  <div class="lp-arch-card">
    <strong>packages/view-canvas</strong>
    <span>Canvas 视图、输入、选区、光标和 node view 运行时</span>
  </div>
  <div class="lp-arch-card">
    <strong>packages/layout-engine</strong>
    <span>断行、布局、分页与页面复用</span>
  </div>
  <div class="lp-arch-card">
    <strong>packages/render-engine</strong>
    <span>基础默认 renderer 与 mark adapter</span>
  </div>
  <div class="lp-arch-card lp-arch-card--wide">
    <strong>packages/extension-*</strong>
    <span>图片、表格、签名、书签、mention、slash command 等业务块和交互扩展</span>
  </div>
</div>

应用层负责组装，核心层负责编辑器能力，布局和渲染层负责页面计算与绘制，业务块最终落在各自的 `extension-*` 包中。

## 快速开始命令

```bash
pnpm install
pnpm docs:dev
pnpm dev:lumen
pnpm dev
```

## 从哪里开始看

### 产品和应用接入

- [从 Lumen 入口开始](/guide/lumen-entry)
- [如何配置编辑器](/guide/lumen-config)
- [扩展组装方式](/guide/lumen-extensions)
- [StarterKit 与扩展选择](/guide/starter-kit-and-extensions)
- [工具栏能力](/guide/toolbar-actions)

### API

- [Lumen App 入口 API](/api/lumen-app)
- [工具栏 API](/api/toolbar-actions)
- [插件总览 API](/api/plugins)
- [Core API](/api/core)

### Demo

- [基础编辑器 Demo](/demo/basic-editor)
- [Lumen 应用 Demo](/demo/lumen-app)
- [斜杠命令 Demo](/demo/slash-command)
