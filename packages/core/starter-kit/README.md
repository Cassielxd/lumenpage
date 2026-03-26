# lumenpage-starter-kit

> 目录：`packages/core/starter-kit`

## 包定位
常用扩展聚合包，对齐 tiptap StarterKit 的使用方式。

## 当前职责
- 打包常见文档节点、文本标记和基础行为扩展。
- 为快速创建编辑器提供默认组合。
- 减少业务侧逐个手动引入扩展的成本。

## 入口与结构
- 包名：`lumenpage-starter-kit`
- 主要入口：`src/index.ts`
- 构建方式：以 workspace 包形式被其他包或应用引用

## 对外导出
- `export type { StarterKitOptions } from "./starter-kit";`
- `export * from "./starter-kit";`

## 依赖关系
### Workspace 依赖
- `lumenpage-core`
- `lumenpage-extension-blockquote`
- `lumenpage-extension-bold`
- `lumenpage-extension-bullet-list`
- `lumenpage-extension-code`
- `lumenpage-extension-code-block`
- `lumenpage-extension-document`
- `lumenpage-extension-hard-break`
- `lumenpage-extension-heading`
- `lumenpage-extension-horizontal-rule`
- `lumenpage-extension-italic`
- `lumenpage-extension-list-item`
- `lumenpage-extension-ordered-list`
- `lumenpage-extension-paragraph`
- `lumenpage-extension-smart-input-rules`
- `lumenpage-extension-strike`
- `lumenpage-extension-text`
- `lumenpage-extension-undo-redo`

### 第三方依赖
- 无第三方运行时依赖。

## 典型用法
```ts
import { Editor } from "lumenpage-core";
import StarterKit from "lumenpage-starter-kit";

const editor = new Editor({
  element,
  extensions: [StarterKit],
});
```

## 适用场景
- 需要在当前 monorepo 中复用这部分能力时直接引用该包。
- 需要做二次封装时，可以把它作为更高层扩展或应用包的基础依赖。
- 如果该包属于扩展层，通常会和 `lumenpage-core` 的 `Editor` 一起使用。

## 备注
- 这个包只做聚合，不应该承载底层 spec 定义。
