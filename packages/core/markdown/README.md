# lumenpage-markdown

> 目录：`packages/core/markdown`

## 包定位
Markdown 解析与序列化桥接层，用于在文档模型和 Markdown 文本之间转换。

## 当前职责
- 提供 Markdown 到文档节点树的解析能力。
- 提供文档节点树到 Markdown 的序列化能力。
- 作为导入导出链路的一部分给上层应用复用。

## 入口与结构
- 包名：`lumenpage-markdown`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export {schema} from "./schema"`
- `export {defaultMarkdownParser, MarkdownParser} from "./from_markdown"`
- `export type {ParseSpec} from "./from_markdown"`
- `export {MarkdownSerializer, defaultMarkdownSerializer, MarkdownSerializerState} from "./to_markdown"`

## 依赖关系
### Workspace 依赖
- `lumenpage-core`
- `lumenpage-extension-image`
- `lumenpage-extension-link`
- `lumenpage-extension-table`
- `lumenpage-extension-underline`
- `lumenpage-extension-video`
- `lumenpage-link`
- `lumenpage-model`
- `lumenpage-starter-kit`

### 第三方依赖
- `@types/markdown-it`: `^14.0.0`
- `markdown-it`: `^14.0.0`

## 典型用法
```ts
import { MarkdownParser, MarkdownSerializer } from "lumenpage-markdown";
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 当前项目仍以文档模型和 Canvas 视图为主，Markdown 属于外围能力。
