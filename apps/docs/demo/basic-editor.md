# 基础编辑器 Demo

这是最小可用的 Lumenpage 编辑器示例。

## 运行方式

```bash
pnpm dev
```

默认会启动 `apps/playground`。

## 本地入口

- Playground: `http://localhost:5173/`
- Playground + DevTools: `http://localhost:5173/?devTools=1`

## 最小代码

```ts
import { Editor } from "lumenpage-core";
import { StarterKit } from "lumenpage-starter-kit";
import { CanvasEditorView } from "lumenpage-view-canvas";

const editor = new Editor({
  extensions: [StarterKit],
  content: "<p>Hello Lumenpage</p>",
});

new CanvasEditorView({
  editor,
  mount: document.querySelector("#editor")!,
});
```

## 适合验证的能力

- 基础输入
- 命令链
- StarterKit 默认扩展
- Canvas 渲染和分页联动
