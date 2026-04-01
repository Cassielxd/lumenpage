# 从 Lumen 入口开始

如果你的目标是理解“当前项目到底已经做到哪一层”，最应该先看的不是底层 engine，而是 `apps/lumen`。

Lumen 是当前最接近真实文档产品壳的入口，它把编辑器、分页、协作、AI、标注、标尺和右侧工作区整合到了同一个应用里。

## 核心入口链路

当前最重要的几处文件是：

1. `apps/lumen/src/App.vue`
2. `apps/lumen/src/editor/editorMount.ts`
3. `apps/lumen/src/editor/config.ts`
4. `apps/lumen/src/editor/documentExtensions.ts`

它们分别负责：

- `App.vue`
  页面壳、工具栏、浮动操作、右侧工作区、标注层、标尺和统计展示
- `editorMount.ts`
  创建 `Editor` 和 `CanvasEditorView`，并把评论、修订、统计、协作回调接出来
- `config.ts`
  运行时 flags、分页 worker、权限模式、协作参数、页面参数和页面 chrome
- `documentExtensions.ts`
  文档扩展装配，决定 Lumen 这层实际支持哪些能力

## `App.vue` 现在管哪些事

`App.vue` 已经不只是“挂一个编辑器”。

它当前整合了：

- 顶部菜单栏与工具栏
- 编辑区和分页视图容器
- 顶部水平标尺和左侧垂直标尺
- `AnnotationLayer` 标注覆盖层
- 右侧工作区
  评论、协作、AI、修订、标注
- 浮动侧边操作入口
- footer 统计与协作状态

也就是说，Lumen 的产品壳能力已经明显高于 Playground。

## `editorMount.ts` 现在返回什么

`mountPlaygroundEditor()` 是 `apps/lumen` 最核心的装配工厂。

它会：

- 创建分页配置和 worker 配置
- 创建协作运行时
- 装配文档扩展、运行时扩展和权限插件
- 创建 `Editor`
- 从 `editor.view` 拿到 `CanvasEditorView`
- 绑定评论、修订、统计、TOC 和协作状态回调

它返回的不只是 `view`，还包含一组产品层可直接调用的能力：

- 目录开关
- 评论 anchor 和评论线程聚焦
- 修订开关、聚焦、接受、拒绝
- 协作文档引用
- 销毁函数

这说明 Lumen 不是把所有逻辑都直接写在 `App.vue` 里，而是把“产品壳调用编辑器能力”的边界放在 `editorMount.ts`。

## Lumen 当前的产品壳能力

围绕当前项目状态，Lumen 已经具备这些明显的产品层能力：

- 评论和评论线程
- Track Changes / 修订工作流
- 协作状态展示与协作设置
- AI 助手面板和 provider 配置
- 文档标注工作区
- 交互式文档标尺
- 国际化和语言切换

这些能力并不都属于同一层：

- 评论、修订、AI 是围绕扩展与命令系统接入
- 协作和 AI 服务通过 `apps/collab-server` 提供
- 标注和标尺属于 Lumen 产品壳上的工作区能力

## 推荐阅读顺序

如果你接下来想继续往下看，建议顺序是：

1. `App.vue`
2. `editorMount.ts`
3. `config.ts`
4. `documentExtensions.ts`
5. `packages/extensions/*`
6. `packages/engine/view-canvas`
