# lumenpage-view-runtime

> 目录：`packages/view-runtime`

## 包定位
视图运行时公共层，集中放置视图共享类型、辅助方法和运行时约定。

## 当前职责
- 为不同视图实现提供统一类型。
- 沉淀跨视图复用的运行时工具。
- 减少 core 与具体视图实现的直接耦合。

## 入口与结构
- 包名：`lumenpage-view-runtime`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export type ViewRuntimeStage = "scaffold";`
- `export const VIEW_RUNTIME_STAGE: ViewRuntimeStage = "scaffold";`
- `export {`
- `export { measureTextWidth, getFontSize } from "./measure";`
- `export { getPageX } from "./pageAlign";`
- `export { getVisiblePages } from "./virtualization";`
- `export { findLineForOffset, offsetAtX, getCaretRect, getCaretFromPoint } from "./caret";`
- `export { coordsAtPos, posAtCoords } from "./posIndex";`
- `export {`
- `export { createSelectionMovement } from "./selectionMovement";`

## 依赖关系
### Workspace 依赖
- 无 workspace 依赖。

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import type { EditorViewLike } from "lumenpage-view-runtime";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
