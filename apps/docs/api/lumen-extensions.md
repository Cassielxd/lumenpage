# Lumen 扩展清单与用法

这一页专门介绍当前仓库 `packages/extensions/*` 下的扩展，以及在项目里怎么使用它们。

如果你只关心 “Lumen 这层实际怎么装配”，先看：

- `apps/lumen/src/editor/documentExtensions.ts`
- `apps/lumen/src/editor/editorMount.ts`

## 先理解 4 种接入方式

### 1. 通过 `StarterKit` 统一接入

很多基础文本能力不需要在 Lumen 里逐个手写扩展，直接通过 `StarterKit` 统一装配。

```ts
const starterKit = StarterKit.configure({ undoRedo: false });

const extensions = [
  starterKit,
];
```

### 2. 直接加入 `extensions`

适合节点类或独立功能扩展。

```ts
const extensions = [
  Audio,
  File,
  Bookmark,
  Table,
  TableRow,
  TableCell,
  TableHeader,
];
```

### 3. 用 `.configure(...)` 注入运行时依赖

适合需要 store、provider、用户信息或服务 provider 的扩展。

```ts
Comments.configure({
  store: lumenCommentsStore,
  showResolved: true,
});

AiAssistant.configure({
  provider: createLumenAiAssistantProvider({ locale }),
});
```

### 4. 作为运行时交互扩展在 `editorMount.ts` 挂载

适合 mention、slash command、bubble menu、drag handle 这类更偏产品层交互的能力。

```ts
const runtimeExtensions = [
  MentionExtension.configure(createMentionPluginOptions()),
  SlashCommandExtension.configure(createSlashCommandOptions(flags.locale)),
  BubbleMenu.configure({ element, render, actions }),
  DragHandleExtension.configure({ onlyTopLevel: true }),
];
```

## Lumen 当前的真实装配参考

### 文档扩展

Lumen 现在的主装配入口是：

- `createLumenDocumentExtensions()`

典型结构是：

```ts
const extensions = [
  StarterKit.configure({ undoRedo: false }),
  ...(collaboration ? [] : [UndoRedo]),
  AiAssistant.configure({
    provider: createLumenAiAssistantProvider({ locale }),
  }),
  ...baseDocumentExtensions,
];
```

### 协作增强

```ts
Collaboration.configure({
  document,
  field,
  provider,
});

CollaborationCaret.configure({
  provider,
  user,
  onUpdate,
});
```

### 运行时交互增强

```ts
const runtimeExtensions = [
  EmbedPanelBrowserViewExtension,
  ActiveBlockSelectionExtension,
  MentionExtension.configure(createMentionPluginOptions()),
  SlashCommandExtension.configure(createSlashCommandOptions(flags.locale)),
  BubbleMenu.configure({ element, render, actions }),
  DragHandleExtension.configure({ onlyTopLevel: true }),
];
```

## 扩展总表

表里的 “最小接入方式” 使用统一术语：

- `StarterKit`：通常由 StarterKit 提供
- `直接加入`：直接放进 `extensions`
- `configure`：需要 `.configure(...)`
- `运行时扩展`：更适合在 `editorMount.ts` 挂载

### 基础文档与文本

| 扩展 | 作用 | 最小接入方式 | Lumen 参考 |
| --- | --- | --- | --- |
| `extension-document` | 文档根节点 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-paragraph` | 段落节点 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-text` | 文本节点 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-heading` | 标题节点 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-blockquote` | 引用块 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-bold` | 粗体 mark | `StarterKit` | `StarterKit.configure(...)` |
| `extension-italic` | 斜体 mark | `StarterKit` | `StarterKit.configure(...)` |
| `extension-underline` | 下划线 mark | 直接加入 | `documentExtensions.ts` |
| `extension-strike` | 删除线 mark | `StarterKit` | `StarterKit.configure(...)` |
| `extension-code` | 行内代码 mark | `StarterKit` | `StarterKit.configure(...)` |
| `extension-code-block` | 代码块 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-hard-break` | 硬换行 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-horizontal-rule` | 分隔线 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-bullet-list` | 无序列表 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-ordered-list` | 有序列表 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-list-item` | 列表项 | `StarterKit` | `StarterKit.configure(...)` |
| `extension-task-list` | 任务列表 | 直接加入 | `documentExtensions.ts` |
| `extension-task-item` | 任务项 | 直接加入 | `documentExtensions.ts` |
| `extension-subscript` | 下标 | 直接加入 | `documentExtensions.ts` |
| `extension-superscript` | 上标 | 直接加入 | `documentExtensions.ts` |
| `extension-text-style` | 文本样式容器 | 直接加入 | `documentExtensions.ts` |

### 结构、布局与页面能力

| 扩展 | 作用 | 最小接入方式 | Lumen 参考 |
| --- | --- | --- | --- |
| `extension-columns` | 多列布局 | 直接加入 | `documentExtensions.ts` |
| `extension-page-break` | 分页符 | 直接加入 | `documentExtensions.ts` |
| `extension-table` | 表格主体 | 直接加入 | `documentExtensions.ts` |
| `extension-option-box` | 选项块 | 直接加入 | `documentExtensions.ts` |
| `extension-callout` | 提示块 | 直接加入 | `documentExtensions.ts` |

> 表格相关扩展在 Lumen 里通常成组使用：`Table`、`TableRow`、`TableCell`、`TableHeader`。

### 协作、审阅与编辑交互

| 扩展 | 作用 | 最小接入方式 | Lumen 参考 |
| --- | --- | --- | --- |
| `extension-active-block` | 当前块高亮/选中态 | 运行时扩展 | `editorMount.ts` |
| `extension-ai` | 文档 AI 上下文提取与结果应用 | `configure` | `AiAssistant.configure(...)` |
| `extension-bubble-menu` | 选区气泡菜单 | `configure` | `editorMount.ts` |
| `extension-changeset` | 变更集支撑能力 | 直接加入或作为依赖层 | 通常由修订能力间接使用 |
| `extension-collaboration` | 协作文档同步 | `configure` | `documentExtensions.ts` |
| `extension-collaboration-caret` | 协作光标与用户态 | `configure` | `documentExtensions.ts` |
| `extension-comment` | 评论锚点和评论线程 | `configure` | `Comments.configure(...)` |
| `extension-drag-handle` | 块拖拽手柄 | `configure` | `editorMount.ts` |
| `extension-mention` | mention 实体插入 | `configure` | `editorMount.ts` |
| `extension-popup` | 弹出层基础能力 | 直接加入或按场景使用 | 作为 UI/交互基础设施 |
| `extension-slash-command` | `/` 命令面板 | `configure` | `editorMount.ts` |
| `extension-smart-input-rules` | 智能输入规则 | `StarterKit` 或直接加入 | 由编辑器输入规则链使用 |
| `extension-tag` | 标签节点 | 直接加入 | `documentExtensions.ts` |
| `extension-track-change` | 修订 / Track Changes | 直接加入 | `documentExtensions.ts` |
| `extension-undo-redo` | Undo / Redo | 直接加入 | `documentExtensions.ts` |

### 业务节点与富媒体

| 扩展 | 作用 | 最小接入方式 | Lumen 参考 |
| --- | --- | --- | --- |
| `extension-audio` | 音频块 | 直接加入 | `documentExtensions.ts` |
| `extension-bookmark` | 书签卡片 | 直接加入 | `documentExtensions.ts` |
| `extension-embed-panel` | 嵌入面板与浏览器侧能力 | 直接加入 + 运行时扩展 | `documentExtensions.ts` + `editorMount.ts` |
| `extension-file` | 附件块 | 直接加入 | `documentExtensions.ts` |
| `extension-image` | 图片节点 | 直接加入 | `documentExtensions.ts` |
| `extension-link` | 链接 mark | 直接加入 | `documentExtensions.ts` |
| `extension-math` | 公式块 | 直接加入 | `documentExtensions.ts` |
| `extension-seal` | 印章能力 | 直接加入 | 按业务场景装配 |
| `extension-signature` | 签名块 | 直接加入 | `documentExtensions.ts` |
| `extension-template` | 模板块 | 直接加入 | `documentExtensions.ts` |
| `extension-text-box` | 文本框块 | 直接加入 | `documentExtensions.ts` |
| `extension-video` | 视频块 | 直接加入 | `documentExtensions.ts` |
| `extension-web-page` | 网页嵌入块 | 直接加入 | `documentExtensions.ts` |

### 基础设施与内部支撑

| 扩展 | 作用 | 最小接入方式 | Lumen 参考 |
| --- | --- | --- | --- |
| `extension-block-id` | 稳定块 ID | 直接加入 | `documentExtensions.ts` |

## 几个常见配置案例

### 评论

```ts
Comments.configure({
  store: lumenCommentsStore,
  showResolved: true,
});
```

适用场景：

- 评论线程
- 评论锚点
- 评论面板和编辑器状态联动

### AI

```ts
AiAssistant.configure({
  provider: createLumenAiAssistantProvider({ locale }),
});
```

适用场景：

- 基于当前选区、当前块或全文生成内容
- 将结果插回文档
- 与 Lumen 的 AI 面板和服务代理配合

### 协作

```ts
Collaboration.configure({
  document,
  field,
  provider,
});

CollaborationCaret.configure({
  provider,
  user,
  onUpdate,
});
```

适用场景：

- Yjs 文档同步
- 协作用户状态
- 远端光标与协作面板

### 气泡菜单、斜杠命令、Mention

```ts
BubbleMenu.configure({ element, render, actions });
MentionExtension.configure(createMentionPluginOptions());
SlashCommandExtension.configure(createSlashCommandOptions(flags.locale));
```

适用场景：

- 面向产品壳的交互增强
- 需要结合 locale、DOM 容器和 UI renderer

## 什么时候参考 Lumen，什么时候单独写

推荐优先参考 Lumen 的场景：

- 你要做的是应用层产品壳
- 你需要评论、修订、协作、AI 这种组合能力
- 你需要知道扩展和工具栏、面板、服务端如何协同

可以直接单独接入扩展的场景：

- 你只需要某一个节点或 mark
- 你只想验证某个交互扩展
- 你在做自己的产品壳，不需要完全复用 Lumen 的 UI
