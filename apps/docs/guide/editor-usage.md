# 编辑器初始化

Lumenpage 的初始化分两层：

1. `lumenpage-core` 负责 Editor、Extension、schema、命令和事件
2. `lumenpage-view-canvas` 负责 CanvasEditorView、分页渲染和交互

## 只初始化 Editor

适合服务端处理、状态测试或上层封装。

```ts
import { Editor } from "lumenpage-core";
import { StarterKit } from "lumenpage-starter-kit";

const editor = new Editor({
  extensions: [StarterKit],
  content: "<p>Document</p>",
});

editor.commands.setContent("<p>Updated</p>");
```

## 初始化 Canvas 视图

```ts
import { Editor } from "lumenpage-core";
import { CanvasEditorView } from "lumenpage-view-canvas";
import { StarterKit } from "lumenpage-starter-kit";

const editor = new Editor({
  extensions: [StarterKit],
  content: "<p>Hello</p>",
});

const view = new CanvasEditorView({
  editor,
  mount: document.querySelector("#app")!,
});
```

## 事件

`Editor` 内部使用 EventEmitter 风格事件系统，常用事件包括：

- `create`
- `update`
- `selectionUpdate`
- `transaction`
- `focus`
- `blur`
- `destroy`

```ts
editor.on("update", ({ editor }) => {
  console.log(editor.getJSON());
});
```

## 推荐实践

- 基础文本编辑优先从 `StarterKit` 开始
- 业务块单独引入对应 `extension-*`
- 不要把业务块 renderer 塞回核心渲染层
