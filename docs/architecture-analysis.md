# LumenPage 架构分析（2026-02-27）

## 范围

- 说明当前（非历史）分层架构与核心数据流。
- 标注扩展点与边界，避免功能改动回流到核心硬编码。

## 分层结构（当前有效）

- `core`：模型、状态、事务、命令基础设施
- `engine`：分页布局、Canvas 渲染、运行时映射
- `extensions`：schema、node 扩展、插件扩展、kit 装配
- `apps`：产品壳（Lumen/Playground）

治理约束：`core -> engine -> extensions -> apps`

## 主链路

1. 输入事件进入 `view-canvas` 输入管线
2. 生成事务并更新 `EditorState`
3. `layout-engine` 从文档生成分页布局
4. `renderer/renderSync` 绘制页面与 overlay
5. `view-runtime` 保持 `pos/offset/coords` 闭环

## 关键扩展点

- Node 侧：`NodeRendererRegistry`
  - `toRuns`
  - `layoutBlock`
  - `splitBlock`
  - `renderLine`
  - `createNodeView`
- 行为侧：`CanvasEditorViewProps` + `Plugin.props`
- 产品侧：`apps/lumen/src/editor/toolbarActions/*`

## 当前结论（纠偏）

1. 表格跨页并非“缺失能力”，当前已通过复杂节点分页协议实现（`layoutBlock/splitBlock`）。
2. `view-canvas/layout-pagination` 目前是转发层，核心分页实现在 `packages/engine/layout-engine`。
3. 业务规则应留在插件/应用层，渲染层只处理几何与绘制。

## 推荐阅读

- `docs/project-onboarding-handbook.md`（总入口）
- `docs/core-hook-boundary-analysis.md`（Hook 与职责边界）
- `docs/pagination-layout.md`（分页实现细节）
