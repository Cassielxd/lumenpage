# 扩展组装方式

`apps/lumen/src/editor/documentExtensions.ts` 是当前文档级扩展清单。

## 基础原则

当前项目的组装方式是：

1. `StarterKit` 提供基础文本编辑能力
2. 文档块扩展在 `documentExtensions.ts` 统一注册
3. 运行时扩展在 `editorMount.ts` 追加注册

## 文档扩展

当前文档扩展包括：

- `StarterKit`
- `BlockIdExtension`
- `Audio`
- `EmbedPanel`
- `File`
- `Bookmark`
- `Callout`
- `Columns`
- `Math`
- `OptionBox`
- `Signature`
- `Underline`
- `Link`
- `Tag`
- `Template`
- `TextBox`
- `TextStyle`
- `Subscript`
- `Superscript`
- `Image`
- `Video`
- `WebPage`
- `PageBreak`
- `Table`
- `TableRow`
- `TableCell`
- `TableHeader`
- `TaskList`
- `TaskItem`

## 运行时扩展

`editorMount.ts` 还会再加这些运行时扩展：

- `EmbedPanelBrowserViewExtension`
- `ActiveBlockSelectionExtension`
- `MentionExtension`
- `SlashCommandExtension`
- `BubbleMenu`
- `DragHandleExtension`

## 为什么分两层

因为这两类扩展的职责不同：

- 文档扩展：决定 schema 和块能力
- 运行时扩展：决定交互、弹层、浏览器行为和插件

## 推荐实践

如果你要新增业务块：

1. 先做 `packages/extension-xxx`
2. 再加到 `documentExtensions.ts`
3. 如果它需要浏览器态增强，再在 `editorMount.ts` 追加运行时扩展
