# Popup 插件生命周期规范（P2.4）

## 目标

统一 `mention` / `selectionBubble` 这类弹层插件的实现方式，确保：

- 生命周期一致（start/update/exit）
- 键盘事件处理一致
- 坐标系处理一致（编辑区坐标 -> 视口坐标）
- 自定义渲染与默认渲染可并存

## 公共能力

位置：`packages/extensions/editor-plugins/src/popup/popupLifecycle.ts`

- `PopupRenderLifecycle<TProps>`
  - `onStart(props)`
  - `onUpdate(props)`
  - `onExit(props)`
  - `onKeyDown(props + event)`
  - `isEventInside(event)`
- `createPopupRenderRuntime(renderer, onFallbackExit)`
  - 统一维护 started/currentProps 状态
  - 统一执行生命周期切换
  - 提供 `handleKeyDown` / `isEventInside` 供插件桥接 DOM 事件

坐标转换工具：

- `packages/extensions/editor-plugins/src/popup/coords.ts`
  - `toPopupRect`
  - `toViewportPopupRect`

## Mention 规范

位置：`packages/extensions/editor-plugins/src/mention.ts`

- 扩展选项：
  - `render?: () => MentionRenderLifecycle`
  - `popupOptions?: PopupControllerOptions`
- 键盘桥接：
  - 插件 `props.handleKeyDown` 通过 `WeakMap<view, runtime>` 调用生命周期 `onKeyDown`
- 定位策略：
  - 使用 `coordsAtPos` 取光标位置信息
  - 强制转换到视口坐标后交给 tippy

## SelectionBubble 规范

位置：`packages/extensions/editor-plugins/src/selectionBubble.ts`

- 扩展选项：
  - `render?: () => SelectionBubbleRenderLifecycle`
  - `popupOptions?: PopupControllerOptions`
  - `shouldShow?: ({ view, selection, rect }) => boolean`
- 定位策略：
  - 以 `selection.head` 为锚点，邻位回退
  - 坐标统一转为视口坐标

## 开发约束

1. 弹层插件必须复用 `createPopupRenderRuntime`，不得各自维护 started/currentProps。
2. 弹层坐标必须经过 `toViewportPopupRect`，禁止直接把内部坐标传给 tippy。
3. 自定义 `render` 必须实现 `onExit` 或保证 fallback hide 可生效。
4. 多实例场景必须使用 `WeakMap` 绑定 view 级运行时，禁止使用模块级单例状态。

