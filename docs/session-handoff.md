# 会话接手入口（2026-03-09）

## 本次优化优先读

1. `docs/large-doc-optimization-handoff-2026-03-09.md`
2. `docs/pagination-layout.md`
3. `docs/architecture-analysis.md`
4. `docs/project-onboarding-handbook.md`

## 当前主线

- 目标：优化 300+ 页大文档输入与回车性能
- 已确认：主瓶颈在 `worker-provider` 布局链，不在 renderer
- 已开始：把 `splitBlock` 从黑名单节点推进成 fragment-aware 节点

## 当前结论

- `render-cache` 已基本生效
- `layout-apply` 开销较小
- `layout-pass.computeMs` 仍然偏高
- 最近已收窄页复用禁用条件，并给 table/list 补了分页能力声明

## 下次继续前

- 先跑一轮 `?debugPerf=1&perfDoc=1&paginationWorker=1&paginationIncremental=1`
- 重点看 `[perf][layout-pass]`
- 关注字段：
  - `disablePageReuse`
  - `reuseReason`
  - `reusedPages`
  - `syncFromIndex`
  - `computeMs`
