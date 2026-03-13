# 核心 Hook 边界与职责分析

更新时间：2026-03-13

## 范围

- 分析 `packages/view-canvas` 中 hook 注入点、调用链和职责边界
- 明确“扩展负责什么”与“渲染/视图运行时负责什么”
- 对齐当前真实目录：`view-canvas`、`layout-engine`、`render-engine`、`view-runtime`

## 1. Hook 调度模型

### 1.1 统一收集入口

- 入口位于 `packages/view-canvas/src/view/editorView/plugins.ts`
- `getEditorPropsList` 会按顺序收集：
  1. `CanvasEditorViewProps`
  2. `state.plugins[*].props`

结论：

- 外层 view props 优先于插件 props
- 行为扩展仍以 `Plugin.props` 为主，符合 ProseMirror 语义

### 1.2 两类调用语义

- `dispatchEditorProp(name, ...args)`
  - 布尔型短路 hook
  - 第一个返回 `true` 的 handler 会终止后续处理
- `queryEditorProp(name, ...args)`
  - 查询型 hook
  - 第一个返回非空值的 handler 会终止后续查询

## 2. 当前主要 EditorProps 类别

### 2.1 状态与生命周期

- `dispatchTransaction`
- `onChange`
- `editable`
- `attributes`
- `formatStatusText`
- `getText`
- `parseHtmlToSlice`

这类 hook 属于“扩展/业务策略层”，不应写死在渲染实现里。

### 2.2 选区与节点选择

- `nodeSelectionTypes`
- `isNodeSelectionTarget`
- `selectionGeometry`
- `createSelectionBetween`（仍需继续评估是否保留）

其中 `selectionGeometry` 是视图层与扩展层的关键边界：扩展决定特殊选区的几何结果，视图负责消费几何结果进行绘制。

### 2.3 输入与剪贴板

- `handleBeforeInput`
- `handleInput`
- `handleKeyDown`
- `handleTextInput`
- `handleCompositionStart/Update/End`
- `handlePaste`
- `handleCopy`
- `handleCut`
- `transformPasted`
- `transformPastedText`
- `transformPastedHTML`
- `transformCopied`
- `transformCopiedHTML`
- `clipboardTextSerializer`
- `clipboardTextParser`
- `clipboardSerializer`
- `clipboardParser`
- `domParser`

结论：

- 这些 hook 应由扩展注入
- `view-canvas` 只负责调度、默认行为和事件桥接

### 2.4 鼠标、拖拽、触摸事件

- `handleClickOn`
- `handleClick`
- `handleDoubleClickOn`
- `handleDoubleClick`
- `handleTripleClickOn`
- `handleTripleClick`
- `handleDOMEvents`
- `handleTouchStart/Move/End`
- `handleDragStart/Over/Leave/Drop/End`
- `resolveDragNodePos`
- `dragCopies`

这类 hook 中，拖拽和触摸仍有一部分是隐式扩展点，后续应继续显式类型化。

## 3. 渲染侧扩展接口

### 3.1 Node 渲染

定义核心位于 `packages/render-engine` 与 `packages/layout-engine` 的注册表。

常见职责：

- `toRuns`
- `layoutBlock`
- `splitBlock`
- `allowSplit`
- `cacheLayout`
- `getCacheSignature`
- `renderLine`
- `renderContainer`
- `createNodeView`

结论：

- Node 渲染扩展负责“如何布局、如何分裂、如何绘制、是否需要 overlay”
- 业务规则不应直接塞进这些接口

### 3.2 Mark 渲染

当前 mark 渲染不再独立拆包，而是与 `render-engine` 同层管理。

常见职责：

- mark annotation
- mark adapter
- 默认文本样式绘制
- 自定义 mark 覆盖默认绘制

结论：

- Mark 与 Node 在概念上不同，但在 Canvas 渲染体系中共享同一套渲染引擎是合理的
- 新增 mark 默认实现应放在 `render-engine`，而不是另起空壳包

### 3.3 视图运行时

`packages/view-runtime` 负责：

- 光标几何
- 位置信息索引
- 虚拟化
- 选区移动
- 页面对齐和测量

这层不负责业务规则，只负责把布局结果转换为交互所需的数据结构。

## 4. 扩展层 vs 渲染层

### 4.1 扩展层负责什么

- schema 注册
- command / shortcut / input rule
- plugin props
- suggestion、bubble menu、drag handle 等行为
- 业务级策略判断

典型扩展：

- `packages/extension-mention`
- `packages/extension-bubble-menu`
- `packages/extension-drag-handle`
- `packages/extension-link`

### 4.2 渲染层负责什么

- layout 计算
- page cache / render cache
- visible page 合成
- overlay 与 canvas 绘制
- 消费扩展产出的 rect、decoration、node view

结论：

- 扩展层负责“要不要这样做”
- 渲染层负责“如何把结果画出来”

## 5. 当前主要问题

1. 一部分输入/拖拽 hook 仍未完全显式类型化
2. `createSelectionBetween` 是否保留仍需决策
3. `selectionGeometry` 的返回契约还可以继续收紧
4. `view-canvas` 仍承担较重总装职责，后续可以继续下沉

## 6. 当前建议

1. 继续把隐式 hook 补齐到 `CanvasEditorViewProps`
2. 为 `selectionGeometry` 建立明确返回结构
3. 继续把策略判断留在扩展层，避免回流到渲染器
4. 所有默认 Node/Mark 渲染实现统一落在 `render-engine`
