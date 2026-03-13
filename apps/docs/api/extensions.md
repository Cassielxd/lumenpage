# Extension API

Lumenpage 的扩展 API 设计尽量贴近 tiptap。

## 三种基础扩展

### `Extension`

通用扩展基类，适合插件、命令、键盘快捷键、状态增强。

```ts
import { Extension } from "lumenpage-core";

const MyExtension = Extension.create({
  name: "myExtension",
});
```

### `Node`

块或行内节点扩展。

```ts
import { Node } from "lumenpage-core";

const Callout = Node.create({
  name: "callout",
});
```

### `Mark`

文本 mark 扩展。

```ts
import { Mark } from "lumenpage-core";

const Underline = Mark.create({
  name: "underline",
});
```

## 常见扩展能力

- `addOptions`
- `addAttributes`
- `addCommands`
- `addKeyboardShortcuts`
- `addInputRules`
- `addPasteRules`
- `addPlugins`
- `addNodeView`
- `addRenderer`
- `addMarkAdapter`
- `addMarkAnnotation`

## 设计边界

- 基础渲染 fallback 可以来自引擎层
- 业务节点自己的 renderer / node view 由扩展自己负责
