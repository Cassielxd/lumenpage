# lumenpage-model

> 目录：`packages/lp/model`

## 包定位
底层文档模型层，对应 ProseMirror model 包。

## 当前职责
- 定义 Node、Fragment、Mark、Schema、ResolvedPos 等核心数据结构。
- 负责 schema 校验、文档树构建和 DOM 解析/序列化。
- 是上层 state、transform、core 的基础。

## 入口与结构
- 包名：`lumenpage-model`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export {Node} from "./node"`
- `export {ResolvedPos, NodeRange} from "./resolvedpos"`
- `export {Fragment} from "./fragment"`
- `export {Slice, ReplaceError} from "./replace"`
- `export {Mark} from "./mark"`
- `export {Schema, NodeType, MarkType} from "./schema"`
- `export type {Attrs, NodeSpec, MarkSpec, AttributeSpec, SchemaSpec} from "./schema"`
- `export {ContentMatch} from "./content"`
- `export {DOMParser} from "./from_dom"`
- `export type {GenericParseRule, TagParseRule, StyleParseRule, ParseRule, ParseOptions} from "./from_dom"`
- `export {DOMSerializer} from "./to_dom"`
- `export type {DOMOutputSpec} from "./to_dom"`

## 依赖关系
### Workspace 依赖
- 无 workspace 依赖。

### 第三方依赖
- `orderedmap`: `^2.1.1`

## 典型用法
```ts
import { Schema, DOMParser, DOMSerializer } from "lumenpage-model";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 这是整个项目最底层的数据结构之一。
