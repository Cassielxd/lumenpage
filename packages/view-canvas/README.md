# lumenpage-view-canvas

> 目录：`packages/view-canvas`

## 包定位
Canvas 版编辑视图实现，等价于 DOM 编辑器里的 EditorView 角色。

## 当前职责
- 承接输入、选区、光标、滚动和命中测试。
- 把布局结果交给渲染层，驱动分页页面绘制。
- 维护视图运行时状态，并对接 `layout-engine`、`render-engine`、`view-runtime`。
- 提供基础块相关的默认 node view 装配能力，例如图片、表格、视频。

## 不负责的内容
- 业务块的默认 node view，例如音频、书签、文件、网页嵌入、签名等。
- 业务扩展的弹窗和工具交互。

这类能力现在应保留在各自 `extension-*` 包中。

## 入口与结构
- 包名：`lumenpage-view-canvas`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `CanvasEditorView` 及相关视图 API
- 视图运行时与输入桥接能力
- 布局分页接线
- 基础块默认 node view

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

## 备注
- 这是当前项目区别于 tiptap / ProseMirror DOM 视图的核心包。
- 它现在只保留基础视图能力，不再默认携带业务扩展 node view。
