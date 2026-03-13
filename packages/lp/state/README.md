# lumenpage-state

> 目录：`packages/lp/state`

## 包定位
底层编辑器状态层，对应 ProseMirror state 包。

## 当前职责
- 维护 EditorState、Selection、Transaction。
- 管理插件状态与事务元信息。
- 为上层命令和视图提供统一状态读写模型。

## 入口与结构
- 包名：`lumenpage-state`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export {Selection, SelectionRange, TextSelection, NodeSelection, AllSelection} from "./selection"`
- `export type {SelectionBookmark} from "./selection"`
- `export {Transaction} from "./transaction"`
- `export type {Command} from "./transaction"`
- `export {EditorState} from "./state"`
- `export type {EditorStateConfig} from "./state"`
- `export {Plugin, PluginKey} from "./plugin"`
- `export type {PluginSpec, StateField, PluginView} from "./plugin"`

## 依赖关系
### Workspace 依赖
- `lumenpage-model`
- `lumenpage-transform`
- `lumenpage-view-types`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { EditorState, Plugin, TextSelection } from "lumenpage-state";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 无额外备注。
