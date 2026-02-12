# Headless ProseMirror + Canvas 分页编辑器实现文档

## 目标
- 以 ProseMirror 作为文档模型与事务内核，完全 headless（不使用 EditorView）。
- 保留自研分页布局与 Canvas 渲染，获得类似腾讯文档的分页体验。
- 输入与 IME 由隐藏 textarea 接收，事务驱动渲染。

## 技术选型
- ProseMirror core: prosemirror-model/state/transform/commands/history/inputrules/keymap
- 协作可选：prosemirror-collab 或 Yjs
- 构建方式（二选一）
  1) 本地构建：Vite/ESBuild/Rollup + npm 依赖（推荐）
  2) 无构建：使用 import map + CDN ESM（适合原型）

## 总体架构
- 编辑内核：EditorState + Schema + Transaction + plugins（history/collab/inputrules）
- 输入桥接：textarea 捕获 beforeinput/keydown/composition/paste → 生成 transaction
- 布局引擎：state.doc → runs → lines → pages（输出位置映射）
- 渲染引擎：Canvas 绘制分页、文本、选区、光标
- 映射层：coordsAtPos / posAtCoords / selectionRects

```
Input/IME → Transaction → EditorState → Layout → Canvas Render
                    ↑                       ↓
               Selection update ← coords/pos mapping
```

## 目录结构规划（建议）
- src/editor/schema.js: 定义 Schema、marks、nodes
- src/editor/state.js: createState、dispatchTransaction、plugin 注入
- src/editor/commands.js: 封装常用编辑命令与快捷键映射
- src/input/bridge.js: beforeinput/keydown/composition/paste 处理
- src/layout/engine.js: 文档到分页布局的入口
- src/layout/textRuns.js: doc → runs（带样式）
- src/layout/lineBreaker.js: 行内断行策略
- src/layout/posIndex.js: pos ↔ coords 映射
- src/render/canvasRenderer.js: Canvas 渲染
- src/render/selection.js: selection → rects
- src/core/virtualization.js: 可视分页范围

## 关键数据结构
- LayoutResult
  - pages: PageLayout[]
  - pageWidth/pageHeight/pageGap/margin/lineHeight/font
  - totalHeight
- PageLayout
  - index
  - lines: LineLayout[]
- LineLayout
  - fromPos/toPos
  - y/height
  - runs: RunLayout[]
- RunLayout
  - fromPos/toPos
  - text
  - style: { font, size, color, bold, italic, ... }
  - x/width
- PosIndex
  - posToLine: Map<pos, {pageIndex, lineIndex, x, y}>
  - lineToPos: 每行可按 runs 进行二分定位

## 事务与渲染链路
1) 输入事件生成 transaction
2) dispatchTransaction 更新 EditorState
3) 从 state.doc 生成 LayoutResult
4) 更新 spacer/scroll 高度，重绘 Canvas
5) 根据 selection 更新 caret/selection 绘制
6) 更新 textarea 位置（用于 IME 候选框）

## 输入桥接（headless）
- beforeinput: 作为主入口（支持 insertText/delete/insertParagraph 等）
- keydown: 处理导航与快捷键（Arrow/Home/End/Ctrl+B/I/U/Z/Y）
- composition: compositionstart/update/end
- paste: HTML → Slice → replaceSelection，纯文本 → insertText

输入事件映射（示例）：
- insertText → tr.insertText(text, from, to)
- deleteContentBackward → deleteSelection 或 joinBackward
- insertParagraph → splitBlock
- insertFromPaste → replaceSelection(slice)

## IME 处理（关键）
- compositionstart: 记录起始 selection
- compositionupdate: 不直接写入 doc，绘制临时 overlay（或使用临时 decoration）
- compositionend: 将最终文本插入 doc，清理 overlay
- textarea 始终定位到 caret 的 coordsAtPos 位置，保证候选框准确

## 坐标映射
- coordsAtPos(pos)
  - 从 PosIndex 获取行信息，计算 x/y/height
- posAtCoords(x,y)
  - 找到页与行 → 在 runs 内按宽度二分定位字符位置
- selectionRects(from,to)
  - 按行切片生成矩形，Canvas 绘制高亮

## 布局引擎细节
- doc → runs
  - 使用 doc.nodesBetween 输出文本与 marks
  - 非文本节点（图片/公式）作为 inline atom，占位一个 glyph
- 行内断行
  - 使用 Intl.Segmenter + UAX#14 规则
  - 每个 run 按样式测量宽度，缓存 TextMetrics
- 分页
  - 以 pageHeight/margin/lineHeight 切页
  - 对 block 节点定义分页策略（可拆分、不可拆分、孤儿/寡妇行）
- 表格/图片
  - 表格先按行内布局成 block，超页时拆行或整体下移
  - 图片按 attrs 宽高占位，可异步加载后刷新布局

## 渲染引擎
- 只渲染可视页（virtualization）
- 绘制顺序
  1) 背景页
  2) 文本 runs
  3) 装饰（下划线/高亮）
  4) 选区
  5) 光标
- 高 DPI 适配：canvas.width/height = css * devicePixelRatio

## 剪贴板
- 粘贴 HTML：DOMParser.fromSchema(schema).parseSlice
- 复制：DOMSerializer.fromSchema(schema).serializeFragment
- 纯文本：textBetween + insertText

## 协作与历史
- history 插件：undo/redo
- collab/Yjs：接收 steps → dispatchTransaction → 重排
- 协作光标：远端 selection 转为装饰绘制

## 分阶段拆解（按此实现）

### Phase 0: 基础工程
- 选定构建方式（Vite 或 import map）
- 引入 ProseMirror 依赖
- 新建 src/editor 与 src/layout 目录
- 验收：能在浏览器运行并加载依赖

### Phase 1: PM 内核替换 DocModel
- 建立 Schema（doc/paragraph/text）
- 创建 EditorState 与 dispatchTransaction
- 用 state.doc.textBetween 替代 doc.getText
- 验收：插入/删除文本驱动重排

### Phase 2: runs 与样式
- 实现 doc → runs（包含 marks）
- LayoutEngine 使用 runs 进行行内排版
- 渲染不同样式（bold/italic/color）
- 验收：不同 marks 文本正确渲染

### Phase 3: 坐标映射与选区
- 实现 coordsAtPos / posAtCoords
- selectionRects 用于绘制选区
- 更新 caret 定位逻辑
- 验收：鼠标点击定位、拖选、键盘移动正确

### Phase 4: 输入桥接完善
- beforeinput 覆盖 insert/delete/paragraph
- keydown 快捷键与导航
- composition 处理 IME
- paste 解析 HTML
- 验收：中文输入、粘贴、撤销/重做正常

### Phase 5: 复杂节点
- 列表、引用、代码块
- 图片与表格（inline/block）
- 分页策略（禁止断页/可拆分）
- 验收：复杂节点分页与布局稳定

### Phase 6: 性能与协作
- 增量布局（仅重排受影响块）
- 页面缓存/局部重绘
- 协作接入（collab 或 Yjs）
- 验收：大文档滚动与输入流畅

## 验收清单（最小）
- 输入：普通文字、回车、退格、撤销/重做
- 选区：点击、拖选、Shift+方向键
- IME：中文输入、候选框位置正确
- 分页：跨页插入、删除后分页稳定
- 粘贴：HTML 与纯文本

## 参考接口（伪代码）
```js
// src/editor/state.js
export function createEditorState(schema, plugins) {}
export function dispatchTransaction(tr) {}

// src/layout/engine.js
export function layoutFromDoc(doc, settings) {}

// src/layout/posIndex.js
export function coordsAtPos(layout, pos) {}
export function posAtCoords(layout, x, y) {}

// src/input/bridge.js
export function attachInputBridge(textarea, editorApi) {}
```
