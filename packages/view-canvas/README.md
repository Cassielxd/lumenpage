# lumenpage-view-canvas

> 目录：`packages/view-canvas`

## 包定位
Canvas 版编辑视图实现，等价于 DOM 编辑器里的 EditorView 角色。

## 当前职责
- 承接输入、选区、光标、滚动和命中测试。
- 把布局结果交给渲染层，驱动分页页面绘制。
- 维护视图运行时状态，并对接 layout-engine、render-engine。

## 入口与结构
- 包名：`lumenpage-view-canvas`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export * from "./core/index";`
- `export * from "./extensionRuntime";`
- `export * from "./view/index";`
- `export * as layoutPagination from "./layout-pagination/index";`
- `export {`

## 依赖关系
### Workspace 依赖
- `lumenpage-link`
- `lumenpage-layout-engine`
- `lumenpage-render-engine`
- `lumenpage-view-runtime`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { CanvasEditorView } from "lumenpage-view-canvas";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 这是当前项目区别于 tiptap/ProseMirror DOM 视图的核心包。
