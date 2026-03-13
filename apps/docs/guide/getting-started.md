# 快速开始

本页说明如何在当前 monorepo 中启动文档、Playground 和业务应用。

## 安装依赖

```bash
pnpm install
```

## 常用命令

```bash
pnpm dev
pnpm dev:lumen
pnpm docs:dev
pnpm build
pnpm docs:build
```

## 文档站位置

文档站位于 `apps/docs`，使用 VitePress 构建。

## 最小接入示例

```ts
import { Editor } from "lumenpage-core";
import { StarterKit } from "lumenpage-starter-kit";

const editor = new Editor({
  extensions: [StarterKit],
  content: "<p>Hello Lumenpage</p>",
});
```

## 下一步

- 想看编辑器接线：读 [编辑器初始化](/guide/editor-usage)
- 想看 API：读 [Core API](/api/core)
- 想看例子：读 [基础编辑器 Demo](/demo/basic-editor)
