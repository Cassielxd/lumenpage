# 分页布局逻辑说明

本文档说明 `view-canvas` 的分页布局流程、关键数据结构、增量复用策略与分页拆分规则。

## 1. 入口与目标

分页布局的核心入口在 `LayoutPipeline.layoutFromDoc`，目标是把 ProseMirror 文档转换为分页后的 `pages/lines` 结构，供渲染层按页绘制。

- 入口：`packages/view-canvas/src/layout-pagination/engine.ts`
  - `layoutFromDoc(doc, options)`：主入口，支持增量复用。
  - `layoutFromRuns(runs, totalLength)`：直接从 runs 断行分页。
  - `layoutFromText(text)`：纯文本入口（内部走 runs）。

## 2. 输入与依赖

### 2.1 settings（分页参数）
由 `CanvasConfig` 或外部注入，关键字段：

- `pageWidth / pageHeight`：页宽/页高。
- `pageGap`：页间距。
- `margin`：页边距（left/right/top/bottom）。
- `lineHeight / font`：默认行高/字体。
- `measureTextWidth`：文本测量函数（断行必需）。
- `wrapTolerance / minLineWidth`：断行容错参数。
- `segmentText`：可选分词函数（中文或复杂断词时使用）。

### 2.2 registry（节点渲染器注册表）
渲染器允许节点自定义 runs/布局/分页拆分逻辑：

- `toRuns(node, settings)`：输出 runs。
- `layoutBlock({ node, settings, availableHeight, ... })`：输出块级布局结果。
- `allowSplit / splitBlock`：控制跨页拆分。
- `getContainerStyle`：容器节点的缩进/样式。

## 3. 核心数据结构

### 3.1 Run（文本运行）
位于 `packages/view-canvas/src/layout-pagination/textRuns.ts`：

- `text`：文本内容。
- `start / end`：在整体文本中的偏移范围。
- `style`：字体、颜色、下划线等。
- `blockType / blockId / blockAttrs / blockStart`：所属块信息。
- `break` 类型：表示块之间的显式断行。

### 3.2 Line（行）
由断行器生成：

- `text / width / runs`：行文本与宽度。
- `start / end`：行在全局文本的偏移范围。
- `x / y`：行在页面内的坐标。
- `blockType / blockId / blockAttrs`：块信息。
- `containers`：容器栈（用于嵌套缩进/渲染）。

### 3.3 Page / LayoutResult

- `pages`: `[{ index, lines }]`
- `totalHeight`: 所有页的高度（含页间距）
- 其余字段来自 `settings`（pageWidth/pageHeight/margin 等）。

## 4. 主流程（layoutFromDoc）

### 4.1 增量布局与复用
当传入 `previousLayout` 和 `changeSummary` 时，会尝试复用未变化的页面：

1. 根据 `changeSummary.blocks.before/after` 定位变更区。
2. 通过 `docPosToTextOffset` + `findBlockAnchor` 找到旧布局锚点。
3. 从锚点处开始重新布局，旧布局的前半部分直接复用。
4. 当页级签名一致时，停止布局并复用后续页面。

关键点：

- 只有 `settings` 完全一致才允许复用。
- 复用判断基于 “页签名 + 行数”。

对应代码：`packages/view-canvas/src/layout-pagination/engine.ts`。

### 4.2 构建 runs
文档被转换为 runs：

- `docToRuns` 遍历根级块，维护全局 offset。
- 文本块走 `textblockToRuns`，非文本块可走 `renderer.toRuns`。
- 块之间插入 `break` run 作为段落间隔。

对应代码：`packages/view-canvas/src/layout-pagination/textRuns.ts`。

### 4.3 断行（breakLines）
断行器根据测量函数将 runs 拆成行：

- 支持 `segmentText` 自定义分词。
- 对于超长 token，会逐字拆分。
- 每行保留 `start/end/runs` 以便后续映射。

对应代码：`packages/view-canvas/src/layout-pagination/lineBreaker.ts`。

### 4.4 叶子块布局（layoutLeafBlock）
每个可布局的块（叶子或自定义块）会被转换为行：

1. 优先使用 `renderer.layoutBlock`。
2. 否则走 `renderer.toRuns` 或默认 runs → `breakLines`。
3. 计算块的 `height/length/lineHeight`。
4. 缓存：`blockCache` 按 `blockId + indent` 复用。

### 4.5 分页与拆分
分页核心循环在 `layoutLeafBlock` 内：

- 计算 `availableHeight`。
- 若块剩余高度超过当前页剩余高度：
  - 若允许拆分：优先调用 `splitBlock`。
  - 否则按行数拆分（`maxLines`）。
  - 切片时用当前切片的 `start/end` 计算 `visibleLength`。
- 将可见行写入当前页，然后 `finalizePage()` 创建新页。
- 若还有剩余行，继续在新页放置。

关键修复点：

- 不再要求 “页内已有内容” 才能拆分，空白页也允许拆分。
- `visibleLength` 用当前切片的 `start/end` 计算，避免跨多页拆分时偏移错误。

对应代码：`packages/view-canvas/src/layout-pagination/engine.ts`。

### 4.6 容器与嵌套缩进
支持容器节点（如 blockquote）：

- `walkBlocks` 递归遍历子节点。
- `getContainerStyle` 生成缩进与容器样式。
- `containerStack` 写入到每行，渲染阶段可画容器背景或边框。

对应代码：`packages/view-canvas/src/layout-pagination/engine.ts`。

### 4.7 列表布局（有序/无序）
列表节点使用单独的布局逻辑：

- 根据 marker 文本宽度计算可用内容宽度。
- 每个 `list_item` 先做 runs，再断行。
- 行首写入 `listMarker`，渲染阶段绘制编号/圆点。

对应代码：`packages/node-list/src/index.ts`。

## 5. 关键边界与行为说明

- 空块：若断行结果为空，会注入一个空行，保证页面仍有可布局内容。
- 最后一页：若布局结束时 `page.lines` 非空，会追加到 `pages`。
- 复用中断：若页签名不一致，则继续正常布局直到文档末尾。
- 大块跨多页：在空白新页也允许拆分，保证可连续分页。

## 6. 相关文件清单

- `packages/view-canvas/src/layout-pagination/engine.ts`
- `packages/view-canvas/src/layout-pagination/lineBreaker.ts`
- `packages/view-canvas/src/layout-pagination/textRuns.ts`
- `packages/node-list/src/index.ts`

如需补充更多渲染侧细节（例如页层 Canvas 组织、选区映射与输入层定位），告诉我再补一份渲染说明文档。
