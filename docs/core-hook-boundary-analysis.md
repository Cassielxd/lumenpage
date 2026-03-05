# 核心库钩子拆解与职责边界

更新时间：2026-02-27

## 范围

- 分析 `packages/engine/view-canvas` 的钩子入口、调用链和职责边界。
- 明确「插件负责什么」与「渲染实现负责什么」。
- 补充 `layout-pagination` 目录每个文件的职责说明。

## 1. Hook 调度模型（核心机制）

### 1.1 统一收集来源

- 入口：`packages/engine/view-canvas/src/view/editorView/plugins.ts`
- `getEditorPropsList` 会按顺序收集：
  1. `CanvasEditorViewProps`（构造时传入的 props）
  2. `state.plugins[*].props`

这意味着：**外层 view props 优先于插件 props**。

### 1.2 两种调用语义

- `dispatchEditorProp(name, ...args)`：用于布尔拦截型钩子。  
  命中第一个返回 `true` 的 handler 即停止（短路）。
- `queryEditorProp(name, ...args)`：用于查询型钩子。  
  命中第一个返回非 `null/undefined` 的值即停止（短路）。

## 2. 标准 EditorProps 钩子（`CanvasEditorViewProps`）

定义文件：`packages/engine/view-canvas/src/view/editorView/types.ts`

### 2.1 生命周期 / 状态类

| Hook | 作用 | 主要调用点 | 归属 |
| --- | --- | --- | --- |
| `dispatchTransaction` | 接管事务派发 | `stateFlow.ts` | 插件/业务层 |
| `onChange` | 接收变更事件 | `stateFlow.ts` | 插件/业务层 |
| `editable` | 控制只读/可编辑 | `propsState.ts` | 插件/业务层 |
| `attributes` | 合并根 DOM 属性 | `propsState.ts` | 插件/业务层 |
| `formatStatusText` | 状态栏文本格式化 | `renderSync.ts` | 插件/业务层 |
| `getText` | 覆写 doc->offset text | `runtimeHelpers.ts` | 插件/业务层 |
| `parseHtmlToSlice` | 覆写 HTML 解析 | `parseHtml.ts` | 插件/业务层 |
| `isInSpecialStructureAtPos` | 判定特殊结构边界（如 table） | `runtimeHelpers.ts` + `editorOps.ts` | 插件/业务层 |
| `shouldAutoAdvanceAfterEnter` | Enter 后是否自动推进 caret | `runtimeHelpers.ts` + `editorOps.ts` | 插件/业务层 |

### 2.2 选区 / 节点选择类

| Hook | 作用 | 主要调用点 | 归属 |
| --- | --- | --- | --- |
| `nodeSelectionTypes` | NodeSelection 白名单 | `selectionPolicy.ts` | 插件/业务层 |
| `isNodeSelectionTarget` | 自定义 NodeSelection 判定 | `selectionPolicy.ts` | 插件/业务层 |
| `selectionGeometry` | 特殊选区几何（rect）计算策略 | `renderSync.ts` | 渲染扩展层 |
| `createSelectionBetween` | 预留 API，当前未接线 | 仅定义于 `types.ts` | 未使用（待清理或接线） |

### 2.3 输入 / 剪贴板类

| Hook | 作用 | 主要调用点 | 归属 |
| --- | --- | --- | --- |
| `handleBeforeInput` | beforeinput 拦截 | `input/handlers.ts` | 插件行为层 |
| `handleInput` | input 拦截 | `input/handlers.ts` | 插件行为层 |
| `handleKeyDown` | keydown 拦截 | `input/handlers.ts` | 插件行为层 |
| `handleKeyPress` | keypress 拦截 | `input/handlers.ts` | 插件行为层 |
| `handleTextInput` | 文本输入拦截/接管默认插入 | `input/handlers.ts` | 插件行为层 |
| `handleCompositionStart` | IME 开始 | `input/handlers.ts` | 插件行为层 |
| `handleCompositionUpdate` | IME 更新 | `input/handlers.ts` | 插件行为层 |
| `handleCompositionEnd` | IME 结束 | `input/handlers.ts` | 插件行为层 |
| `handlePaste` | 粘贴拦截 | `input/handlers.ts` | 插件行为层 |
| `handleCopy` | 复制拦截 | `input/clipboard.ts` | 插件行为层 |
| `handleCut` | 剪切拦截 | `input/clipboard.ts` | 插件行为层 |
| `transformPasted` | 粘贴 Slice 后处理 | `inputPipeline.ts` | 插件行为层 |
| `transformPastedText` | 粘贴纯文本预处理 | `inputPipeline.ts` | 插件行为层 |
| `transformPastedHTML` | 粘贴 HTML 预处理 | `inputPipeline.ts` | 插件行为层 |
| `transformCopied` | 复制 Slice 预处理 | `inputPipeline.ts` | 插件行为层 |
| `transformCopiedHTML` | 复制 HTML 预处理 | `inputPipeline.ts` | 插件行为层 |
| `clipboardTextSerializer` | Slice -> text 序列化 | `inputPipeline.ts` | 插件行为层 |
| `clipboardTextParser` | text -> Slice 解析 | `inputPipeline.ts` | 插件行为层 |
| `clipboardSerializer` | 自定义 HTML serializer | `inputPipeline.ts` | 插件行为层 |
| `clipboardParser` | 自定义剪贴板 parser | `parseHtml.ts` | 插件行为层 |
| `domParser` | 自定义 DOM parser | `parseHtml.ts` | 插件行为层 |

### 2.4 鼠标事件链类

| Hook | 作用 | 主要调用点 | 归属 |
| --- | --- | --- | --- |
| `handleClickOn` | 命中节点链点击拦截 | `editorView/events.ts` | 插件行为层 |
| `handleClick` | 点击拦截 | `editorView/events.ts` | 插件行为层 |
| `handleDoubleClickOn` | 命中节点链双击拦截 | `editorView/events.ts` | 插件行为层 |
| `handleDoubleClick` | 双击拦截 | `editorView/events.ts` | 插件行为层 |
| `handleTripleClickOn` | 命中节点链三击拦截 | `editorView/events.ts` | 插件行为层 |
| `handleTripleClick` | 三击拦截 | `editorView/events.ts` | 插件行为层 |
| `handleDOMEvents` | 统一挂载原生 DOM 事件 map | `plugins.ts` | 插件行为层 |

### 2.5 渲染注入类

| Hook | 作用 | 主要调用点 | 归属 |
| --- | --- | --- | --- |
| `decorations` | 提供装饰层数据 | `editorView/decorations.ts` + `renderSync.ts` | 渲染扩展层 |
| `nodeViews` | 提供 NodeView 工厂 | `editorView/nodeViews.ts` | 渲染扩展层 |

## 3. 非类型化“隐式钩子”（当前真实使用）

这些钩子已在运行时被调用，但没有显式写入 `CanvasEditorViewProps` 类型，仅依赖 `[key: string]: any`：

| Hook | 作用 | 调用点 |
| --- | --- | --- |
| `handleTouchStart` | 触摸开始拦截 | `input/touchHandlers.ts` |
| `handleTouchMove` | 触摸移动拦截 | `input/touchHandlers.ts` |
| `handleTouchEnd` | 触摸结束拦截 | `input/touchHandlers.ts` |
| `handleDragStart` | 拖拽开始拦截 | `editorView/drag.ts` |
| `handleDragOver` | 拖拽悬停拦截 | `editorView/drag.ts` |
| `handleDragLeave` | 拖拽离开拦截 | `editorView/drag.ts` |
| `handleDrop` | 放置拦截 | `editorView/drag.ts` |
| `handleDragEnd` | 拖拽结束拦截 | `editorView/drag.ts` |
| `resolveDragNodePos` | 从事件解析拖拽节点 pos | `editorView/interactions.ts` / `drag.ts` |
| `dropCursor` | drop cursor 样式配置 | `editorView/drag.ts` |
| `createDropCursorDecoration` | 自定义 drop cursor 装饰 | `editorView/drag.ts` |
| `dragCopies` | 决定拖放是 copy 还是 move | `editorView/drag.ts` |
| `handleScrollToSelection` | 覆写 scrollIntoView 行为 | `editorView/publicApi.ts` |
| `scrollMargin` | scrollIntoView margin 配置 | `editorView/publicApi.ts` |
| `scrollThreshold` | scrollIntoView 阈值配置 | `editorView/publicApi.ts` |

## 4. 渲染侧扩展接口（非 EditorProps）

### 4.1 NodeRenderer（布局/绘制主扩展点）

定义：`packages/engine/layout-engine/src/nodeRegistry.ts`

| 接口 | 作用 | 职责归属 |
| --- | --- | --- |
| `toRuns` | 节点转文本 runs | 节点扩展（插件侧） |
| `layoutBlock` | 自定义块布局 | 节点扩展（插件侧） |
| `splitBlock` | 跨页拆分 | 节点扩展（插件侧） |
| `allowSplit` | 是否允许拆分 | 节点扩展（插件侧） |
| `cacheLayout` | 是否参与块缓存 | 节点扩展（插件侧） |
| `getCacheSignature` | 自定义缓存签名 | 节点扩展（插件侧） |
| `renderLine` | 自定义 canvas 行绘制 | 节点扩展（插件侧） |
| `getContainerStyle` | 容器样式（如缩进） | 节点扩展（插件侧） |
| `renderContainer` | 容器绘制 | 节点扩展（插件侧） |
| `createNodeView` | DOM/overlay NodeView | 节点扩展（插件侧） |

### 4.2 CanvasNodeView（视图层对象）

定义：`packages/engine/view-canvas/src/view/nodeView.ts`

主要方法：`update`、`destroy`、`selectNode`、`deselectNode`、`handleClick`、`handleDoubleClick`、`syncDOM`。  
用途：给复杂节点（媒体、拖拽句柄、浮层）提供 DOM overlay 生命周期。

### 4.3 Renderer settings 级扩展（渲染实现层）

调用位置：`packages/engine/view-canvas/src/view/renderer.ts`

| 配置项 | 作用 |
| --- | --- |
| `renderPageBackground` | 覆写页面背景绘制 |
| `renderPageChrome` | 覆写页眉页脚/角标等页面装饰绘制 |
| `onPageCanvasStyle` | 可见页 canvas DOM 样式回调 |
| `selectionStyle` | 选区填充/边框/圆角样式 |
| `paginationDebugBuilder` / `tablePaginationDebugBuilder` | 分页调试摘要构建器 |

## 5. `layout-pagination` 目录每个文件是做什么的

目录：`packages/engine/view-canvas/src/layout-pagination`

| 文件 | 作用 |
| --- | --- |
| `engine.ts` | 转发导出 `LayoutPipeline`（实际实现位于 `lumenpage-layout-engine`） |
| `nodeRegistry.ts` | 转发导出 `NodeRendererRegistry` 与 `NodeRenderer` 类型 |
| `lineBreaker.ts` | 转发导出 `breakLines` |
| `textRuns.ts` | 转发导出 `docToRuns` / `textToRuns` / `textblockToRuns` |
| `index.ts` | 聚合导出上述布局能力和类型 |

结论：该目录当前是**兼容/门面层（facade）**，不承载核心算法逻辑。

## 6. 插件做什么 vs 渲染实现做什么

### 6.1 插件层（行为与策略）

- 通过 `Plugin.props` 和 `Plugin.spec.view` 接入输入、快捷键、点击链、拖拽策略、业务弹层。
- 负责“是否拦截、如何变换、何时显示”的策略判定。
- 典型：`mention`、`selectionBubble`、`dragHandle`（位于 `packages/extensions/editor-plugins`）。

### 6.2 渲染层（几何与绘制）

- 负责 layout 计算、页缓存、可见区合成、overlay 绘制。
- 负责把插件给出的策略结果（如 rect、decorations、nodeViews）转成画面。
- 不应承载业务规则；业务规则应通过钩子注入。

## 7. 拆解合理性评估

### 7.1 当前合理点

- 钩子调度模型清晰：`dispatch`（布尔短路）和 `query`（首个非空值）职责明确。
- 输入、渲染、交互管线分层清楚：`inputPipeline`、`renderSync`、`interactionPipeline`。
- 选区策略已经支持 `selectionGeometry` 下沉，方向正确。
- legacy 配置已支持 `legacyPolicy.strict`，迁移路径存在。

### 7.2 当前不合理/可改进点

1. 隐式钩子未类型化。  
   `handleTouch* / handleDrag* / resolveDragNodePos / dropCursor / handleScrollToSelection` 等真实存在，但不在 `CanvasEditorViewProps` 显式声明，IDE 与类型约束不足。

2. `createSelectionBetween` 仅声明未接线。  
   当前是“看起来可用、实际无效”的死接口。

3. `selectionGeometry` 的类型过于宽泛（`any`）。  
   `resolveSelectionRects/shouldComputeSelectionRects/shouldRenderBorderOnly` 等契约缺少显式类型与文档化，后续维护成本高。

4. 仍有 legacy 双通道。  
   同一策略可走 `EditorProps` 或 `canvasConfig`，虽然有 strict 模式，但实际复杂度仍偏高。

## 8. 建议的下一步（按优先级）

1. 把第 3 章隐式钩子全部补进 `CanvasEditorViewProps` 类型。  
2. 决策 `createSelectionBetween`：要么正式接线，要么删掉。  
3. 给 `selectionGeometry` 建立强类型接口（含返回结构、可选字段、fallback 规则）。  
4. 在文档层明确“策略层必须经 Hook 注入，渲染层不写业务规则”的约束，减少回归硬编码。  
