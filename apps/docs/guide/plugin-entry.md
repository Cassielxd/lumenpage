# 插件入口

这一页是当前项目所有扩展的统一入口。

如果你要接入 Lumenpage，推荐按下面顺序选插件：

1. 先上 `StarterKit`
2. 再补常用文档块
3. 最后再补运行时交互扩展

## 第一层：基础编辑能力

优先使用：

- `lumenpage-starter-kit`

它已经包含：

- `document`
- `text`
- `paragraph`
- `heading`
- `blockquote`
- `code`
- `codeBlock`
- `bulletList`
- `orderedList`
- `listItem`
- `hardBreak`
- `horizontalRule`
- `bold`
- `italic`
- `strike`
- `undoRedo`
- `editingCommands`
- `baseKeymap`
- `canvasKeymap`
- `smartInputRules`

使用方式：

```ts
import { StarterKit } from "lumenpage-starter-kit";

const extensions = [StarterKit];
```

## 第二层：常用文档块

这是 `apps/lumen` 当前默认接入的主要块：

- `Image`
- `Video`
- `File`
- `Audio`
- `Link`
- `Underline`
- `TextStyle`
- `Subscript`
- `Superscript`
- `PageBreak`
- `Tag`
- `Bookmark`
- `Callout`
- `Columns`
- `Math`
- `OptionBox`
- `Signature`
- `Template`
- `TextBox`
- `WebPage`
- `Table`
- `TableRow`
- `TableCell`
- `TableHeader`
- `TaskList`
- `TaskItem`

使用方式：

```ts
import { StarterKit } from "lumenpage-starter-kit";
import { Image } from "lumenpage-extension-image";
import { Table, TableRow, TableCell, TableHeader } from "lumenpage-extension-table";
import { TaskList } from "lumenpage-extension-task-list";
import { TaskItem } from "lumenpage-extension-task-item";

const extensions = [StarterKit, Image, Table, TableRow, TableCell, TableHeader, TaskList, TaskItem];
```

## 第三层：运行时交互扩展

这些扩展更偏交互和浏览器运行时，不只是 schema：

- `MentionExtension`
- `SlashCommandExtension`
- `BubbleMenu`
- `DragHandleExtension`
- `ActiveBlockSelectionExtension`
- `EmbedPanelBrowserViewExtension`

使用方式：

```ts
import BubbleMenu, { DEFAULT_BUBBLE_MENU_ACTIONS } from "lumenpage-extension-bubble-menu";
import { MentionExtension } from "lumenpage-extension-mention";
import { SlashCommandExtension } from "lumenpage-extension-slash-command";
import { DragHandleExtension } from "lumenpage-extension-drag-handle";

const extensions = [
  StarterKit,
  MentionExtension.configure(createMentionPluginOptions()),
  SlashCommandExtension.configure(createSlashCommandOptions("zh-CN")),
  BubbleMenu.configure({
    element: document.createElement("div"),
    actions: DEFAULT_BUBBLE_MENU_ACTIONS,
  }),
  DragHandleExtension.configure({ onlyTopLevel: true }),
];
```

## 推荐接入模板

最接近 `apps/lumen` 的接法：

```ts
const extensions = [
  ...lumenDocumentExtensions,
  EmbedPanelBrowserViewExtension,
  ActiveBlockSelectionExtension,
  MentionExtension.configure(createMentionPluginOptions()),
  SlashCommandExtension.configure(createSlashCommandOptions(flags.locale)),
  BubbleMenu.configure({
    element: bubbleMenuElement,
    actions: DEFAULT_BUBBLE_MENU_ACTIONS,
  }),
  DragHandleExtension.configure({ onlyTopLevel: true }),
];
```

## 下一步

- 想看所有扩展目录和用途：读 [插件总览 API](/api/plugins)
- 想看应用层实际注册：读 [Lumen 扩展清单](/api/lumen-extensions)
