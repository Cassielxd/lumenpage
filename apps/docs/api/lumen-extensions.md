# Lumen 扩展清单 API

文件：

- `apps/lumen/src/editor/documentExtensions.ts`

## `lumenDocumentExtensions`

这是应用层文档扩展数组：

```ts
export const lumenDocumentExtensions = [
  StarterKit,
  BlockIdExtension,
  Audio,
  EmbedPanel,
  File,
  Bookmark,
  Callout,
  Columns,
  Math,
  OptionBox,
  Signature,
  Underline,
  Link,
  Tag,
  Template,
  TextBox,
  TextStyle,
  Subscript,
  Superscript,
  Image,
  Video,
  WebPage,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  TableHeader,
  TaskList,
  TaskItem,
] as const;
```

## 使用方式

`editorMount.ts` 中直接展开到 `extensions`：

```ts
const extensions = [
  ...lumenDocumentExtensions,
  EmbedPanelBrowserViewExtension,
  ActiveBlockSelectionExtension,
  MentionExtension.configure(createMentionPluginOptions()),
  SlashCommandExtension.configure(createSlashCommandOptions(flags.locale)),
  BubbleMenu.configure({ element, actions }),
  DragHandleExtension.configure({ onlyTopLevel: true }),
];
```

## 什么时候改它

- 新增业务块
- 删除默认块
- 调整应用层支持的文档能力

## 不应该放进这里的内容

- 页面尺寸配置
- 粘贴策略
- 统计逻辑
- worker 开关

这些都不属于扩展清单本身。
