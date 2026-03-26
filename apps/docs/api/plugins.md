# 插件总览 API

这一页集中说明当前仓库的 `extension-*` 包，按用途分组，并给出典型使用案例。

## 基础文档与文本

### `lumenpage-extension-document`

- 作用：文档根节点
- 常见场景：和 `text`、`paragraph` 一起构成最小 schema

### `lumenpage-extension-text`

- 作用：文本节点
- 常见场景：所有正文内容的基础节点

### `lumenpage-extension-paragraph`

- 作用：段落块
- 常见场景：正文输入

### `lumenpage-extension-heading`

- 作用：标题块
- 常见场景：章节标题、TOC

```ts
import { Heading } from "lumenpage-extension-heading";

const extensions = [
  Heading.configure({
    levels: [1, 2, 3],
  }),
];
```

### `lumenpage-extension-blockquote`

- 作用：引用块

### `lumenpage-extension-code-block`

- 作用：代码块

### `lumenpage-extension-horizontal-rule`

- 作用：分隔线

### `lumenpage-extension-hard-break`

- 作用：硬换行

## 文本 mark

### `lumenpage-extension-bold`

- 作用：加粗

### `lumenpage-extension-italic`

- 作用：斜体

### `lumenpage-extension-strike`

- 作用：删除线

### `lumenpage-extension-code`

- 作用：行内代码

### `lumenpage-extension-underline`

- 作用：下划线

### `lumenpage-extension-text-style`

- 作用：文本样式载体

### `lumenpage-extension-subscript`

- 作用：下标

### `lumenpage-extension-superscript`

- 作用：上标

## 列表与任务

### `lumenpage-extension-bullet-list`

- 作用：无序列表

### `lumenpage-extension-ordered-list`

- 作用：有序列表

### `lumenpage-extension-list-item`

- 作用：列表项节点

### `lumenpage-extension-task-list`

- 作用：任务列表

### `lumenpage-extension-task-item`

- 作用：任务项，支持勾选

使用案例：

```ts
import { TaskList } from "lumenpage-extension-task-list";
import { TaskItem } from "lumenpage-extension-task-item";

const extensions = [StarterKit, TaskList, TaskItem];
```

## 表格与分页

### `lumenpage-extension-table`

- 作用：表格主扩展，同时导出 `Table`、`TableRow`、`TableCell`、`TableHeader`

### `lumenpage-extension-page-break`

- 作用：显式分页符

使用案例：

```ts
import { Table, TableRow, TableCell, TableHeader } from "lumenpage-extension-table";
import { PageBreak } from "lumenpage-extension-page-break";

const extensions = [StarterKit, Table, TableRow, TableCell, TableHeader, PageBreak];
```

## 媒体与嵌入

### `lumenpage-extension-image`

- 作用：图片块

```ts
import { Image } from "lumenpage-extension-image";

const extensions = [
  Image.configure({
    allowBase64: true,
  }),
];
```

### `lumenpage-extension-video`

- 作用：视频块

### `lumenpage-extension-audio`

- 作用：音频块

### `lumenpage-extension-file`

- 作用：附件块

### `lumenpage-extension-web-page`

- 作用：网页卡片块

### `lumenpage-extension-bookmark`

- 作用：书签块

### `lumenpage-extension-embed-panel`

- 作用：嵌入面板块
- 补充浏览器态：`lumenpage-extension-embed-panel/browser`

使用案例：

```ts
import { Image } from "lumenpage-extension-image";
import { Video } from "lumenpage-extension-video";
import { File } from "lumenpage-extension-file";
import { EmbedPanel } from "lumenpage-extension-embed-panel";
import { EmbedPanelBrowserViewExtension } from "lumenpage-extension-embed-panel/browser";

const extensions = [StarterKit, Image, Video, File, EmbedPanel, EmbedPanelBrowserViewExtension];
```

## 业务块

### `lumenpage-extension-callout`

- 作用：提示块

### `lumenpage-extension-columns`

- 作用：多列布局

### `lumenpage-extension-math`

- 作用：数学公式块

```ts
import { Math } from "lumenpage-extension-math";

const extensions = [
  Math.configure({
    inline: true,
  }),
];
```

### `lumenpage-extension-option-box`

- 作用：选项框块

### `lumenpage-extension-signature`

- 作用：签名块

### `lumenpage-extension-seal`

- 作用：印章块

### `lumenpage-extension-template`

- 作用：模板块

### `lumenpage-extension-text-box`

- 作用：文本框块

### `lumenpage-extension-tag`

- 作用：标签块

使用案例：

```ts
import { Callout } from "lumenpage-extension-callout";
import { Columns } from "lumenpage-extension-columns";
import { Signature } from "lumenpage-extension-signature";
import { TextBox } from "lumenpage-extension-text-box";

const extensions = [StarterKit, Callout, Columns, Signature, TextBox];
```

## 交互与辅助扩展

### `lumenpage-extension-link`

- 作用：链接 mark 和链接命令

```ts
import { Link } from "lumenpage-extension-link";

const extensions = [
  Link.configure({
    openOnClick: false,
  }),
];
```

### `lumenpage-extension-mention`

- 作用：mention 提示与插入

```ts
import { MentionExtension } from "lumenpage-extension-mention";

const extensions = [MentionExtension.configure(createMentionPluginOptions())];
```

### `lumenpage-extension-slash-command`

- 作用：段落开头输入 `/` 后弹出块菜单

```ts
import { SlashCommandExtension } from "lumenpage-extension-slash-command";

const extensions = [SlashCommandExtension.configure(createSlashCommandOptions("zh-CN"))];
```

### `lumenpage-extension-bubble-menu`

- 作用：选区浮动工具条

```ts
import BubbleMenu, { DEFAULT_BUBBLE_MENU_ACTIONS } from "lumenpage-extension-bubble-menu";

const bubbleMenuElement = document.createElement("div");

const extensions = [
  BubbleMenu.configure({
    element: bubbleMenuElement,
    actions: DEFAULT_BUBBLE_MENU_ACTIONS,
  }),
];
```

### `lumenpage-extension-drag-handle`

- 作用：块拖拽手柄

```ts
import { DragHandleExtension } from "lumenpage-extension-drag-handle";

const extensions = [DragHandleExtension.configure({ onlyTopLevel: true })];
```

### `lumenpage-extension-active-block`

- 作用：当前块高亮与活跃块状态

### `lumenpage-extension-block-id`

- 作用：块 ID

### `lumenpage-extension-popup`

- 作用：弹层基础设施

### `lumenpage-extension-smart-input-rules`

- 作用：智能输入规则

### `lumenpage-extension-undo-redo`

- 作用：撤销重做

使用案例：

```ts
import BubbleMenu, { DEFAULT_BUBBLE_MENU_ACTIONS } from "lumenpage-extension-bubble-menu";
import { MentionExtension } from "lumenpage-extension-mention";
import { SlashCommandExtension } from "lumenpage-extension-slash-command";
import { DragHandleExtension } from "lumenpage-extension-drag-handle";

const bubbleMenuElement = document.createElement("div");

const extensions = [
  StarterKit,
  MentionExtension.configure(createMentionPluginOptions()),
  SlashCommandExtension.configure(createSlashCommandOptions("zh-CN")),
  BubbleMenu.configure({
    element: bubbleMenuElement,
    actions: DEFAULT_BUBBLE_MENU_ACTIONS,
  }),
  DragHandleExtension.configure({ onlyTopLevel: true }),
];
```

## 实际项目案例

`apps/lumen` 当前文档能力来自两部分：

1. `documentExtensions.ts` 里的文档扩展
2. `editorMount.ts` 里的运行时扩展

组合方式：

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
