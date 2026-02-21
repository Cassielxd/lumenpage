# LumenPage

LumenPage 是一个基于 Canvas 的分页富文本编辑器工作区。核心目标是用“可复用的布局引擎 + 可插拔的节点渲染器”替代传统 DOM 布局，从而支持稳定的分页、性能可控的渲染，以及更细粒度的渲染与交互优化。

## 项目概览

- 以 ProseMirror 的数据模型为基础，保留 schema/state/transform 等核心概念。
- 视图层采用 Canvas 渲染，分页布局通过独立的 layout pipeline 计算得到。
- 节点渲染按“node 包”拆分，便于扩展、替换和按需组合。
- 支持增量布局复用（changeSummary），对局部编辑场景减少重排开销。

## 主要能力（当前已实现）

- Canvas 渲染与分页布局（支持增量复用、局部重排）。
- 基础节点渲染与交互：段落、标题、列表、代码块、图片、表格、视频、引用等。
- 基础输入链路与命令体系（含 keymap/inputrules/history/gapcursor 的本地适配版本）。
- 视图层性能指标输出（布局/渲染耗时、缓存命中等）。

## 关键设计与架构

- **分层结构**：
  - core：与 DOM 无关的编辑与布局核心。
  - view-canvas：Canvas 渲染与输入/选区处理，内含分页布局引擎。
  - node-*：节点布局与渲染适配层。
  - kit-basic：默认 schema 与节点渲染器聚合。
- **分页布局**：
  - 先生成行布局，再分页拆分。
  - 支持 block 级别的可拆分逻辑（如表格、列表、代码块等）。
  - 支持增量复用：对变更范围外的页面复用历史结果。
- **渲染管线**：
  - layout → render → hit-test/selection。
  - Canvas 中维护 line 级别的渲染数据，用于高效重绘与选区定位。

## Canvas 拖拽实现原理（与 ProseMirror 的差异）

- **为什么不能直接复用 ProseMirror 的文本拖拽方式**：
  - ProseMirror 依赖原生 `contenteditable` 与浏览器真实 DOM 选区，浏览器会自然触发 `dragstart`。
  - LumenPage 的文本选区是 Canvas 虚拟选区，不是浏览器原生文本选区，原生 `dragstart` 触发并不稳定。

- **当前方案**：
  - 采用“内部手势拖拽”替代对原生 `dragstart` 的强依赖：
    1. `pointerdown` 命中已有选区后，进入“潜在拖拽”状态。
    2. `pointermove` 超过阈值（当前 4px）后，启动内部拖拽并绘制 drop cursor。
    3. `pointerup` 时按落点执行 move/copy 事务（复用现有 drop 语义）。
  - 同时保留原生 `dragstart/dragover/drop` 事件链路，作为兼容路径。

- **关键实现位置**：
  - 内部拖拽手势入口：`packages/view-canvas/src/view/input/pointerHandlers.ts`
  - 拖拽状态与落点事务：`packages/view-canvas/src/view/editorView/drag.ts`
  - 交互装配：`packages/view-canvas/src/view/editorView/interactions.ts`
  - 事件绑定：`packages/view-canvas/src/view/editorView/events.ts`

- **当前已处理的两个典型问题**：
  - 节点（如图片）二次点击跳到下方块：通过“跳过下一次 click 选区链路”避免误跳转。
  - 文本选区拖不起来：通过 pointer 手势内部拖拽保证在 Canvas 选区下也可稳定拖动。

## 技术栈

- 语言：TypeScript
- 构建：Vite、pnpm workspace、tsc -b
- 渲染：Canvas 2D
- 编辑核心：基于 ProseMirror 概念模型（schema/state/transform）

## 项目结构

- `apps/playground`：演示应用，入口 `src/main.ts`
- `packages/view-canvas`：Canvas 视图层 + 输入/选区 + 分页布局
- `packages/kit-basic`：默认 schema + 节点渲染器注册
- `packages/node-*`：节点布局与渲染适配（paragraph/heading/list/table/image/video 等）
- `docs/`：设计与说明文档

## 开发与构建

```bash
pnpm install
pnpm dev
```

```bash
pnpm -r build
pnpm -r typecheck
```

## 入口与说明

- Demo 入口：`apps/playground/src/main.ts`
- 设计说明：`docs/pos-offset-mapping.md`（pos ↔ offset ↔ 坐标映射）
- 差异清单：`docs/prosemirror-gap.md`（与 ProseMirror 的未对齐项）
