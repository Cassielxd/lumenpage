# lumenpage-core

> 目录：`packages/core/core`

## 包定位
项目核心层，提供 tiptap 风格的 Editor、Extension、Node、Mark、命令链、事件系统和 schema 组装能力。

## 当前职责
- 管理编辑器实例生命周期、扩展解析和 EditorView 创建流程。
- 定义节点扩展、标记扩展、通用扩展的抽象模型。
- 负责命令链、事件分发、全局属性和扩展解析结果的统一出口。

## 入口与结构
- 包名：`lumenpage-core`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export { Editor } from "./Editor";`
- `export type { EditorOptions } from "./Editor";`
- `export { CommandManager } from "./CommandManager";`
- `export { createChainableState } from "./createChainableState";`
- `export { createDocument } from "./createDocument";`
- `export { EventEmitter } from "./EventEmitter";`
- `export { Extension } from "./Extension";`
- `export { ExtensionManager } from "./ExtensionManager";`
- `export { Mark } from "./Mark";`
- `export { Node } from "./Node";`
- `export {`
- `export { markPasteRule, nodePasteRule, textPasteRule } from "./pasteRules";`

## 依赖关系
### Workspace 依赖
- `lumenpage-inputrules`
- `lumenpage-keymap`
- `lumenpage-layout-engine`
- `lumenpage-link`
- `lumenpage-model`
- `lumenpage-state`
- `lumenpage-view-canvas`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { Editor } from "lumenpage-core";
import StarterKit from "lumenpage-starter-kit";

const editor = new Editor({
  element,
  extensions: [StarterKit],
  content: "<p>Hello Lumenpage</p>",
});
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 如果要对齐 tiptap 的开发体验，这个包就是最上层入口。
