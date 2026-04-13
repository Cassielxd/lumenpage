# Popup 扩展生命周期规范（v2.5）

## 目标

统一 `mention`、`bubble-menu` 等浮层扩展的实现方式，确保：

- 生命周期一致：`start / update / exit`
- 键盘事件处理一致
- 坐标换算一致：编辑器坐标 -> 视口坐标
- 自定义渲染与默认渲染可并存

## 公共能力

位置：

- `packages/core/popup-runtime/src/popupLifecycle.ts`
- `packages/core/popup-runtime/src/popupController.ts`
- `packages/core/popup-runtime/src/coords.ts`

核心能力：

- `PopupRenderLifecycle<TProps>`
  - `onStart(props)`
  - `onUpdate(props)`
  - `onExit(props)`
  - `onKeyDown(props, event)`
  - `isEventInside(event)`
- `createPopupRenderRuntime(renderer, onFallbackExit)`
  - 统一维护 started / currentProps 状态
  - 统一切换生命周期
  - 对外暴露键盘处理与命中判断能力
- `popupController`
  - 当前已基于 `@floating-ui/dom` 实现
  - 不再依赖 `tippy.js`
- 坐标转换工具
  - `toPopupRect`
  - `toViewportPopupRect`

## Mention 约束

位置：

- `packages/extensions/extension-mention/src/mention.ts`
- `packages/core/suggestion/*`

说明：

- mention 的触发、匹配、候选项更新由 suggestion 基础设施负责
- mention 自己只负责把 suggestion 状态转换成 popup 生命周期和插入动作
- popup 位置必须通过 popup 坐标工具统一换算后再交给 controller

## Bubble Menu 约束

位置：

- `packages/extensions/extension-bubble-menu/src/bubble-menu.ts`
- `packages/extensions/extension-bubble-menu/src/bubble-menu-plugin.ts`

说明：

- `BubbleMenu` 应作为选区行为扩展存在，不再沿用旧的 `selectionBubble` 命名
- 是否显示、显示内容、动作执行由扩展决定
- popup controller 只负责位置与显示，不负责业务逻辑

## 开发约束

1. 浮层扩展必须复用 `popup-runtime` 的 controller 与 lifecycle，不允许每个扩展自行维护一套悬浮层状态机。
2. 浮层坐标必须先转换到 viewport，再交给 popup controller。
3. 自定义 `render` 必须实现 `onExit`，或者保证 fallback hide 生效。
4. 多实例场景必须按 view 维度隔离运行时，不允许模块级单例状态污染。
5. 扩展只负责业务判断，公共浮层基础设施只负责定位、生命周期和事件桥接。
