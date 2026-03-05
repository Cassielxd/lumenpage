# LumenPage 项目接手总手册（2026-02-27）

## 1. 文档目标

这份文档用于下次快速接手，覆盖：

- 项目分层与包职责
- 编辑器核心运行链路
- 插件与渲染扩展边界
- Lumen 应用壳接线现状
- 常用命令与排查入口

## 2. 仓库总览

### Workspace

- 包管理：`pnpm workspace`
- 根配置：`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`
- 应用：
  - `apps/lumen`（主产品壳）
  - `apps/playground`（集成与 smoke 场景）

### 分层包结构

- `packages/core`
  - `model/state/transform/commands/keymap/history/inputrules/link/collab/view-types`
  - 职责：文档模型、事务、命令基础、规则基础
- `packages/engine`
  - `layout-engine`
  - `view-canvas`
  - `view-runtime`
  - 职责：排版、渲染、命中映射、输入桥接运行时
- `packages/extensions`
  - `schema-basic`、`kit-basic`
  - `node-basic`、`node-list`、`node-media`、`node-table`
  - `editor-plugins`、`markdown`
  - 职责：节点能力、插件能力、默认装配
- `packages/tooling`
  - `dev-tools`

治理约束：`core -> engine -> extensions -> apps`（由 `pnpm governance:check` 系列脚本守护）。

## 3. 关键启动链路（Lumen）

1. `apps/lumen/src/App.vue`
   - 负责页面壳、目录侧栏、编辑器挂载生命周期。
2. `apps/lumen/src/editor/editorMount.ts`
   - 组装 schema、plugins、Canvas settings、permission、worker provider、TOC 插件。
3. `CanvasEditorView`（`lumenpage-view-canvas`）
   - 建立输入管线、事务流、布局渲染同步、NodeView 生命周期。
4. `layout-engine`
   - 从 doc 生成分页布局结果（支持增量与复杂节点分页协议）。
5. `renderer/renderSync`
   - 页面 canvas 绘制 + overlay（选区/光标/装饰/NodeView）同步。

## 4. 编辑器运行主链路

### 输入到渲染闭环

1. 输入桥接：`view/input/bridge.ts`、`view/input/handlers.ts`
2. 事务派发：`editorView/stateFlow.ts`
3. 变更摘要：`core/editor/changeSummary.ts`
4. 布局计算：`packages/engine/layout-engine/src/engine.ts`
5. 渲染同步：`view/renderSync.ts` + `view/renderer.ts`
6. 映射闭环：`offset <-> pos <-> coords`（`view-runtime` + `view-canvas`）

### 分页与缓存要点

- 复杂节点（如 table）通过 `layoutBlock/splitBlock/allowSplit` 协议分页。
- 块缓存依赖签名（`blockId + signature`），避免重复布局。
- Worker 策略：优先正确性，复杂场景可回退主线程。

## 5. Hook 与扩展边界

### EditorProps/Plugin props 调度

- 收集顺序：`CanvasEditorViewProps` -> `Plugin.props`
- 两种语义：
  - `dispatchEditorProp`：布尔短路（第一个 `true` 生效）
  - `queryEditorProp`：查询短路（第一个非空值生效）

### 插件负责什么

- 输入/键盘/鼠标拦截策略
- 弹层生命周期与交互（mention、selectionBubble、dragHandle）
- 业务行为判定（何时显示、何时接管）

### 渲染层负责什么

- 几何计算、分页结果消费、页面绘制
- overlay 合成与 NodeView 同步
- 不承载业务规则（业务规则通过 Hook 注入）

详情见：`docs/core-hook-boundary-analysis.md`

## 6. Lumen 产品壳现状

### 菜单与功能基线

- 数据源：`apps/lumen/src/editor/toolbarCatalog.ts`
- 当前统计：`103` 项，`99` 已接线，`4` 未接线
- 未接线项：
  - `diagrams`
  - `echarts`
  - `mermaid`
  - `mind-map`
- `export` 顶部 Tab 默认隐藏，但导出动作仍在 base 区域可用

### 关键应用侧模块

- `editorMount.ts`：编辑器总装配
- `toolbarCatalog.ts`：菜单信息架构与实现标记
- `toolbarActions/*`：按功能域拆分动作实现
- `tocOutlinePlugin.ts`：目录采集与 active heading 同步
- `config.ts`：调试参数与分页 worker 开关

## 7. 调试与开发命令

### 常用命令

- 安装：`pnpm install`
- Lumen 开发：`pnpm dev:lumen`
- Playground 开发：`pnpm dev`
- 全量构建：`pnpm build`
- Lumen 构建：`pnpm build:lumen`
- 全量类型检查：`pnpm typecheck`
- Lumen 类型检查：`pnpm -C apps/lumen typecheck`
- 治理检查：`pnpm governance:check`

### 常用 URL 参数（来自 `apps/lumen/src/editor/config.ts`）

- `permissionMode=full|comment|readonly`
- `paginationWorker=true|false`
- `paginationWorkerForce=true|false`
- `paginationIncremental=true|false`
- `paginationMaxPages=<number>`
- `paginationSettleMs=<number>`
- `debugPerf=true|false`
- `inputRules=true|false`
- `contrast=high|normal`

## 8. 已知风险与排查入口

1. 表格分页问题优先看：
   - `packages/engine/layout-engine/src/engine.ts`
   - `packages/extensions/node-table/src/*`
2. 弹层问题优先看：
   - `packages/extensions/editor-plugins/src/popup/*`
   - `mention.ts` / `selectionBubble.ts`
3. 菜单接线问题优先看：
   - `toolbarCatalog.ts` 的 `implemented`
   - `toolbarActions/*` 与 `actionHandlers.ts`
4. 若出现“文档状态与代码不一致”，以 `toolbarCatalog.ts` 和本手册为准，旧文档需同步修正。

## 9. 下次接手建议流程（10 分钟）

1. 读 `docs/session-handoff.md`（入口）
2. 读本手册第 3-8 章（架构和现状）
3. 运行：
   - `pnpm -C apps/lumen typecheck`
   - `pnpm governance:check`
4. 确认要做的功能所在层级（core/engine/extensions/apps）
5. 改完后同步更新：
   - `docs/lumen-menu-feature-checklist.md`
   - `docs/lumen-product-completion-plan.md`

## 10. 相关文档索引

- `docs/session-handoff.md`：会话入口（短版）
- `docs/core-hook-boundary-analysis.md`：Hook 边界详解
- `docs/lumen-menu-feature-checklist.md`：菜单接线清单
- `docs/lumen-product-completion-plan.md`：产品收口计划
- `docs/fix-log-2026-02-24.md`：历史修复记录
- `docs/package-governance-checklist.md`：分层治理清单
- `docs/plugin-popup-lifecycle-guide.md`：弹层插件规范
