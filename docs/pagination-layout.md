# 分页布局设计（Layout Pagination）

## 1. 设计目标

`packages/view-canvas` 的分页引擎需要同时满足三件事：

- 正确性：文档结构、选区映射、命中坐标稳定。
- 性能：大文档可增量更新，避免整文档重排与整页重绘。
- 可扩展：节点布局能力可由 `node-*` 包扩展，不把节点细节写死在核心。

## 2. 模块边界

- `packages/view-canvas/src/layout-pagination/engine.ts`
  - `layoutFromDoc` 主入口
  - 增量布局、分页切分、缓存失效控制
- `packages/view-canvas/src/layout-pagination/textRuns.ts`
  - 将文档节点转换为可换行 runs
- `packages/view-canvas/src/layout-pagination/lineBreaker.ts`
  - 将 runs 按宽度切分为行
- `packages/view-canvas/src/layout-pagination/nodeRegistry.ts`
  - 节点布局/渲染扩展注册

## 3. 核心数据结构

### 3.1 Run

Run 是布局最小文本单元，典型字段：

- `text`
- `start/end`（文本偏移区间）
- `style`
- `blockType/blockId/blockAttrs`
- `break`（强制换行）

### 3.2 Line

行结构承载排版与命中信息：

- `start/end`
- `x/y/width/lineHeight`
- `runs`
- `blockType/blockId`

### 3.3 Page 与 LayoutResult

- `pages: Array<{ index, lines }>`
- `totalHeight`
- 与当前 `settings` 对齐的页面几何信息

## 4. 布局主流程

1. `layoutFromDoc(doc, options)` 接收当前文档与可选 `previousLayout/changeSummary`。
2. 文档转换为 runs（含节点级样式与语义信息）。
3. runs 经过 `lineBreaker` 得到 lines。
4. lines 按页面高度切分为 pages。
5. 生成 `LayoutResult` 并附带增量复用元信息。

## 5. 增量与缓存策略

### 5.1 变更摘要驱动

- 通过 `changeSummary.blocks` 定位受影响 block。
- 仅重排受影响范围及必要邻域，降低全量重排概率。

### 5.2 页级复用

- 使用页面签名与版本标记判断可复用页。
- 未变化页面直接复用缓存画面，减少绘制开销。

### 5.3 渐进布局

- 首先生成“可交互”布局。
- 再异步补全完整布局，保证交互优先。

## 6. 渲染协同

布局与渲染分离：

- 页面内容层：page canvas 缓存。
- overlay 层：选区、光标、装饰、拖拽提示等动态信息。
- NodeView overlay 独立同步，避免与文本层耦合。

## 7. 命中与映射约束

必须保持以下映射稳定：

- `docPos -> textOffset`
- `textOffset -> coords`
- `coords -> docPos`

任何分页、换行、滚动优化都不能破坏这组闭环，否则会出现“光标跳跃/选区错位”。

## 8. Worker 化（可选）

支持将分页计算放入 Worker：

- 主线程保留输入与绘制。
- Worker 处理 runs/line/page 计算。
- 对复杂块（如表格）保留主线程回退，优先保证正确性。

## 9. 调试与验收建议

本地联调入口：

- `?devTools=1&allSmoke=1`
- `?devTools=1&p0Smoke=1`
- `?devTools=1&perfBudgetSmoke=1`

重点关注：

- 大文档滚动/编辑是否出现卡顿尖峰。
- 表格、列表、媒体节点是否触发异常重排。
- 选区矩形、拖拽提示、光标坐标是否稳定。
