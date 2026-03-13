# StarterKit 与扩展选择

接入 Lumenpage 时，最常见的问题不是“怎么写 Editor”，而是“扩展该怎么选”。

## 推荐顺序

### 1. 先上 `StarterKit`

适合大多数编辑器起步场景。

它已经覆盖：

- 文档根节点
- 文本和段落
- 标题
- 引用
- 行内代码和代码块
- 列表
- 基础快捷键
- 撤销重做
- 输入规则

```ts
import { StarterKit } from "lumenpage-starter-kit";

const extensions = [StarterKit];
```

### 2. 再加常用文档块

如果你的场景需要富内容混排，优先补这些：

- `Image`
- `Table`
- `Video`
- `File`
- `Link`
- `PageBreak`
- `TaskList`
- `TaskItem`

```ts
const extensions = [
  StarterKit,
  Image,
  Table,
  TableRow,
  TableCell,
  TableHeader,
  Video,
  File,
  Link,
  PageBreak,
  TaskList,
  TaskItem,
];
```

### 3. 最后加交互扩展

当你已经有了基本文档能力，再补这些交互型扩展：

- `MentionExtension`
- `SlashCommandExtension`
- `BubbleMenu`
- `DragHandleExtension`
- `ActiveBlockSelectionExtension`

## 什么时候不要全量引入

不建议一开始把所有扩展都堆进来，原因很直接：

- schema 更复杂
- 调试范围更大
- 交互冲突更多
- 文档边界更难收敛

更合理的方式是：

1. 先让 `StarterKit` 跑通
2. 再按业务块逐步加
3. 最后再接运行时交互扩展

## 一个接近 `apps/lumen` 的组合

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

## 选择建议

- 只做基础文档：`StarterKit`
- 做富内容文档：`StarterKit + image/table/video/file/link`
- 做业务页面编辑器：在上面基础上继续补 `mention/slash-command/bubble-menu/drag-handle`
