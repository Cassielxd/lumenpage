# 大文档优化接力文档（2026-03-09）

## 目标

- 优化 300+ 页大文档的输入和回车性能
- 目标方向是“任意位置输入接近常数时间”
- 当前重点关注：
  - 分页引擎增量能力
  - 渲染引擎页缓存与局部重绘
  - `splitBlock` 复杂节点的跨页续接状态

## 当前结论

1. 当前主瓶颈不在 renderer
- `render-cache` 已经工作
- 可见页一般是 `cachedPages: 3`、`redrawPages: 1`
- 渲染耗时通常只有几毫秒

2. 当前主瓶颈在 `worker-provider` 布局链
- `layout-apply` 通常只有 `4-9ms`
- `layout-pass.computeMs` 可达数百毫秒到数秒
- 说明主要时间花在布局计算，不在应用布局和绘制

3. 之前页复用被过度保守地禁用了
- 旧逻辑只要命中 `splitBlock` 类型变更，就可能直接禁用页复用
- 这对 table/list 这类 continuation 节点太保守
- 已收窄为：只有旧布局在受影响范围里真的存在跨页切片状态时，才禁用复用

4. `splitBlock` 不能再同时承担两层含义
- 过去它既表示“这个节点有自定义拆分页逻辑”
- 又被拿来当“这个节点一定不能增量复用”的信号
- 这是不合理的

## 架构判断

### ProseMirror 是否适合当前架构

结论：

- 适合做文档模型、事务、选区、历史、协同
- 不适合直接承担分页状态、片段续接状态、渲染缓存状态

正确分层应该是：

1. ProseMirror document state
- schema
- node/block 语义
- transaction
- selection

2. Canvas layout state
- block layout cache
- block fragment / continuation state
- page reuse metadata
- viewport/render cache

### 当前 block 设计是否符合 canvas 架构

结论：

- 作为“语义 block”是合理的
- 作为“分页与绘制的唯一状态单元”是不够的

当前缺少的一层：

- `block fragment`

建议的层次是：

1. PM Block
2. Layout Block State
3. Block Fragment
4. Page

其中 `Block Fragment` 需要至少表达：

- `fragmentStart`
- `fragmentEnd`
- `continuation.fromPrev`
- `continuation.hasNext`
- `continuation.rowSplit`
- 未来建议补：
  - `continuationToken`
  - `fragmentIdentity`
  - `carryState`

## 这轮已完成的代码改动

### 渲染热路径

- 避免高频路径整文档 `getText().length`
- 删除路径改成局部 token 判断
- `render-cache` 页签名去掉绝对 offset 字段，避免“上游插入一个字符导致后续页视觉未变也被误判重绘”

关键文件：

- `packages/view-canvas/src/mapping/offsetMapping.ts`
- `packages/view-canvas/src/core/editor/editorOps.ts`
- `packages/view-canvas/src/view/renderer.ts`

### layoutIndex / selection / decorations

- `layoutIndex` 从全量展平改成按页索引为主、懒构建
- selection / decorations 主路径不再强依赖整本 `layoutIndex.lines`

关键文件：

- `packages/view-runtime/src/layoutIndex.ts`
- `packages/view-canvas/src/view/render/selection.ts`
- `packages/view-canvas/src/view/render/decorations.ts`

### 布局与 worker

- 给 worker-provider 补齐 `cascadePagination` / `cascadeFromPageIndex`
- worker 侧开启 perf 摘要回传
- 主线程的 `layout-pass` 优先读取 worker 回传 perf
- 收窄 `splitBlock` 对页复用的禁用条件

关键文件：

- `apps/playground/src/editor/paginationDocWorkerClient.ts`
- `apps/playground/src/editor/paginationDoc.worker.ts`
- `apps/lumen/src/editor/paginationDocWorkerClient.ts`
- `apps/lumen/src/editor/paginationDoc.worker.ts`
- `packages/view-canvas/src/view/renderSync.ts`
- `packages/layout-engine/src/engine.ts`

### 节点分页能力声明

新增：

- `NodeRenderer.pagination.fragmentModel`
- `NodeRenderer.pagination.reusePolicy`

当前已标注：

- table: `continuation` + `actual-slice-only`
- list: `continuation` + `actual-slice-only`

关键文件：

- `packages/layout-engine/src/nodeRegistry.ts`
- `packages/view-canvas/src/defaultRenderers/table.ts`
- `packages/render-engine/src/defaultRenderers/list.ts`

## 当前调试入口

建议使用：

- `?debugPerf=1`
- `?perfDoc=1`
- `?paginationWorker=1`
- `?paginationIncremental=1`

当前保留的关键 console 输出：

- `[perf][layout-pass]`
  - 只在慢布局时输出
- `[perf][layout-apply]`
  - 只在慢应用时输出

已关闭的高噪音日志：

- `scroll-request:*`
- `render-cache` console 输出

仍可通过全局复制：

- `window.__lumenPerfLogs`
- `window.__copyLumenPerfLogs()`
- `window.__lumenLastRenderPerf`

## 最近一次关键证据

在第一页输入时，曾观察到：

- `render-cache`：
  - `cachedPages: 3`
  - `redrawPages: 1`
- `layout-apply`：
  - `totalApplyMs: 4-9`
- `layout-pass`：
  - `source: worker-provider`
  - `reuseReason: "no-previous-layout"`
  - `reusedPages: 0`
  - `syncFromIndex: null`
  - `blockCacheHitRate: "0%"`
  - `computeMs`: 从数百毫秒到 9 秒

进一步通过 worker 状态日志确认：

- client 并没有每次都重建 worker 请求状态
- worker 也确实保留了 `previousLayoutState`
- 说明问题不是“worker 状态丢失”
- 更可能是布局引擎内部的 reuse guard 或 sync 条件仍未打开

注：

- 以上结论是在“收窄 guard 之前”的日志上确认出来的
- 收窄 guard 之后还需要再跑一轮新日志确认 `disablePageReuse` / `reusedPages` / `syncFromIndex`

## 下次继续时先做什么

1. 先用当前代码重新测第一页输入
- 看 `[perf][layout-pass]` 里的：
  - `disablePageReuse`
  - `reuseReason`
  - `reusedPages`
  - `syncFromIndex`
  - `computeMs`

2. 如果这轮已经能打开 reuse
- 继续做 fragment-aware 增量
- 先从 table/list 开始补：
  - `continuationToken`
  - `fragmentIdentity`
  - `carryState`

3. 如果这轮仍然没有打开 reuse
- 继续排查 `layout-engine` 中 `canSync` / `syncAfterIndex` / `maybeSync`
- 重点检查：
  - `changeSummary.blocks.before/after`
  - `syncAfterIndex`
  - `passedChangedRange`
  - `maybeSyncReason`

## 建议的后续改造顺序

### 第一阶段

- 让 `splitBlock` 节点不再天然是“全禁复用”
- 以真实 slice 状态决定是否禁用

### 第二阶段

- 为 continuation 节点建立稳定 fragment identity
- 让页复用从 page 级过渡到 fragment 级

### 第三阶段

- 分页传播从“整段向后重排”改成“脏 fragment 链传播直到稳定”
- 目标是：输入只重排必要的 block fragment

### 第四阶段

- 渲染层从“脏页整页重绘”继续推进到“脏 fragment / 脏行重绘”

## 读取顺序

下次继续前建议按这个顺序看：

1. 本文档
2. `docs/pagination-layout.md`
3. `docs/architecture-analysis.md`
4. `packages/layout-engine/src/engine.ts`
5. `packages/view-canvas/src/view/renderSync.ts`
