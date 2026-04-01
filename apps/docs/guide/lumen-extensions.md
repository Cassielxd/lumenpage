# Lumen 扩展装配

Lumen 当前的文档扩展装配集中在：

- `apps/lumen/src/editor/documentExtensions.ts`

这层的职责不是实现所有能力，而是决定：

- Lumen 默认支持哪些文档节点和 mark
- 哪些能力需要在协作模式下切换实现
- AI、评论、修订这类产品能力如何进入文档层
- 哪些能力属于文档扩展，哪些能力属于产品壳

## 装配分层

当前可以把 Lumen 的扩展装配分成三组：

### 1. StarterKit 与基础能力

- `StarterKit`
- `UndoRedo`

其中 `UndoRedo` 会根据是否处于协作模式切换启用策略。

### 2. 文档与业务扩展

`baseDocumentExtensions` 当前已经覆盖：

- 评论
- 修订
- AI
- 表格
- 图片、视频、音频、附件
- 书签、模板、网页嵌入
- Tag、Callout、TextBox、Signature
- Columns、PageBreak

### 3. 运行时交互扩展

在 `editorMount.ts` 里还会额外挂上：

- `EmbedPanelBrowserViewExtension`
- `ActiveBlockSelectionExtension`
- `MentionExtension`
- `SlashCommandExtension`
- `BubbleMenu`
- `DragHandleExtension`

也就是说：

- `documentExtensions.ts` 决定“文档支持什么”
- `editorMount.ts` 决定“应用壳如何增强交互”

## 完整扩展总表

如果你想逐个查看当前仓库每一个扩展的用途、最小接入方式和 Lumen 参考装配，直接看：

- [Lumen 扩展清单与用法](/api/lumen-extensions)

这页会按 `packages/extensions/*` 逐个维护。

## 协作模式下的扩展

如果启用了协作，Lumen 还会追加：

- `Collaboration`
- `CollaborationCaret`

同时把用户信息和 provider 传进去。

这条链路说明协作能力不是写死在 editor 核心里，而是通过应用层装配进入。

## AI 是怎么进入扩展链的

AI 当前不是单独在 `App.vue` 里临时写一个面板调用接口。

它的链路是：

1. `AiAssistant` 扩展进入 `documentExtensions.ts`
2. provider 由 `createLumenAiAssistantProvider()` 提供
3. Lumen 面板负责用户交互和设置
4. `collab-server` 负责代理到模型服务

所以 AI 的正确理解是：

- 文档上下文能力在扩展层
- UI 在产品层
- 服务接入在服务端层

## 这一层不应该放什么

不应该放进 `documentExtensions.ts` 的内容包括：

- 页面尺寸和边距
- 标尺 UI
- 标注工作区
- 右侧面板显示状态
- footer 统计

这些属于 Lumen 产品壳，不属于文档扩展装配本身。
