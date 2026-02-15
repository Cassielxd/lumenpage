# CanvasEditorView API（EditorView 风格）

本文档描述 `lumenpage-view-canvas` 的 `CanvasEditorView` API，保持与 ProseMirror `EditorView` 习惯一致。
Canvas 专用配置通过插件注入到 `EditorState`，避免在 `CanvasEditorView` 构造参数中出现扩展字段。

## 构造函数

```ts
new CanvasEditorView(place, props)
```

- `place`: DOM 容器或函数（`(dom: HTMLElement) => void`）。行为与 ProseMirror `EditorView` 一致。
- `props`: 纯 EditorView props。

## 必须参数

- `state`: `EditorState`。必须包含需要的插件（例如 history、canvas 配置插件）。

## 可选参数（EditorView props）

以下字段与 ProseMirror 语义保持一致：

- `dispatchTransaction(tr)`
- `attributes`：对象或函数 `(state) => attrs`，用于 root DOM 的属性（aria 等）
- `nodeViews`：`{ [nodeType: string]: NodeViewFactory }`
- `decorations`：`DecorationSet | Decoration[] | (state) => DecorationSet | Decoration[]`
- `handleDOMEvents`
- `handleKeyDown`
- `handleKeyPress`
- `handleTextInput`
- `handleClick`
- `handleDoubleClick`
- 其它由插件 `props` 提供的 EditorView 行为

## Canvas 配置插件

Canvas 相关配置通过 `createCanvasConfigPlugin` 注入到 `state.plugins`：

```ts
import { createCanvasConfigPlugin } from "lumenpage-view-canvas";

const canvasConfigPlugin = createCanvasConfigPlugin({
  settings,
  nodeRegistry,
  getText: (doc) => docToText(doc),
  commands: { basicCommands, runCommand, setBlockAlign },
});
```

### CanvasConfig 字段

- `settings`: 画布/分页渲染配置（pageWidth/pageHeight/margin/lineHeight 等）
- `elements`: 自定义 DOM 结构（覆盖默认 root/viewport/scrollArea/pageLayer 等）
- `applyDefaultStyles`: 是否应用默认样式（默认 `true`）
- `nodeRegistry`: Canvas 节点渲染注册表（NodeRendererRegistry）
- `commands`: 输入层命令集合（basicCommands/runCommand/setBlockAlign）
- `getText`: 文本抽取函数（用于光标/选区映射）
- `parseHtmlToSlice`: HTML 解析（用于粘贴/拖拽）
- `statusElement`: 状态显示 DOM（可选）
- `collaboration`: 远程协作配置（选区/光标样式）
- `remoteSelections`: 远程选区数据
- `debug`: `{ selection?: boolean; delete?: boolean }`
- `onChange`: 变更回调（接收 changeEvent）

## 完整示例

```ts
import {
  CanvasEditorView,
  createCanvasConfigPlugin,
  createEditorState,
} from "lumenpage-view-canvas";
import { history } from "lumenpage-history";

const canvasConfigPlugin = createCanvasConfigPlugin({
  settings,
  nodeRegistry,
  getText: (doc) => docToText(doc),
  commands: { basicCommands, runCommand, setBlockAlign },
});

const state = createEditorState({
  schema,
  json: initialDocJson,
  plugins: [history(), canvasConfigPlugin],
});

const view = new CanvasEditorView(mount, {
  state,
  dispatchTransaction,
  handleDOMEvents: {
    focus: (view, event) => false,
  },
});
```

## 迁移提示

- 旧的 `canvas` 构造参数已移除，改为 `createCanvasConfigPlugin`。
- 旧的 `schema/doc/json/text` 创建逻辑迁移到 `createEditorState`。
- `history`、协作等插件必须显式加入 `state.plugins`。
