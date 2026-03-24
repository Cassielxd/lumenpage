# LumenPage 项目接手手册（2026-03-13）

## 1. 文档目标

本文档用于快速接手当前仓库，覆盖：

- 仓库分层与包职责
- 编辑器主运行链路
- 扩展与渲染的边界
- app 侧入口
- 常用排查入口

## 2. 仓库总览

### Workspace

- 包管理：`pnpm workspace`
- 根配置：`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`
- 应用：
  - `apps/lumen`：主产品壳
  - `apps/playground`：示例与调试壳

### 当前包结构

- `packages/core/core`
  - `Editor`、扩展系统、schema 装配门面
- `packages/lp/*`
  - `model`、`state`、`transform`、`commands`、`keymap`、`history`、`inputrules`、`collab`、`view-types`
  - 职责：底层编辑模型和事务能力
- `packages/engine/layout-engine`
  - 断行、分页、片段清理、布局复用
- `packages/engine/render-engine`
  - Node/Mark 渲染适配器与默认渲染实现
- `packages/engine/view-runtime`
  - 几何、定位、虚拟化、选区移动
- `packages/engine/view-canvas`
  - Canvas 视图装配、输入桥接、绘制与 overlay
- `packages/extensions/extension-*`
  - 功能扩展
- `packages/core/starter-kit`
  - 默认扩展集合
- `packages/core/dev-tools`
  - 调试面板

治理约束：

- `lp/* -> core -> engine -> extension-* -> apps`
- 底层包不反向依赖 app 或高层扩展

## 3. 关键启动链路

1. `apps/lumen/src/App.vue`
   - 页面壳与编辑器挂载
2. `apps/lumen/src/editor/editorMount.ts`
   - 装配扩展、canvas settings、worker、toolbar 等
3. `packages/core/core`
   - 创建 `Editor`、扩展管理器、schema
4. `packages/engine/view-canvas`
   - 建立输入管线、事务流、布局渲染同步、NodeView 生命周期
5. `packages/engine/layout-engine`
   - 从 doc 计算分页布局
6. `packages/engine/render-engine`
   - 根据 Node/Mark 渲染契约输出 canvas 绘制结果
7. `packages/engine/view-runtime`
   - 命中测试、选区几何、坐标映射、虚拟化

## 4. 编辑器运行主链路

### 输入到渲染闭环

1. 输入桥接：`packages/engine/view-canvas/src/view/input/*`
2. 事务派发：`packages/engine/view-canvas/src/view/editorView/stateFlow.ts`
3. 变更摘要：`packages/engine/view-canvas/src/core/editor/changeSummary.ts`
4. 布局计算：`packages/engine/layout-engine/src/engine.ts`
5. 渲染同步：`packages/engine/view-canvas/src/view/renderSync.ts`
6. 页面绘制：`packages/engine/view-canvas/src/view/renderer.ts`
7. 坐标与选区：`packages/engine/view-runtime/*`

### 分页与缓存

- 复杂节点通过 `splitBlock / allowSplit / pagination` 协议参与分页
- 布局层做 block cache、fragment continuation、page reuse
- 渲染层做 render cache、visible page 绘制与 overlay 同步

## 5. 扩展与渲染边界

### 扩展负责

- schema 定义
- commands / shortcuts / input rules
- plugin props
- suggestion、bubble-menu、drag-handle 等行为
- 业务策略判断

### 渲染负责

- layout 计算
- canvas 绘制
- overlay 与 node view 同步
- 消费扩展提供的 rect、decorations、node view

详见：

- `docs/core-hook-boundary-analysis.md`
- `docs/plugin-popup-lifecycle-guide.md`

## 6. app 侧现状

### Lumen

- 工具栏目录：`apps/lumen/src/editor/toolbarCatalog.ts`
- 动作实现：`apps/lumen/src/editor/toolbarActions/*`
- 编辑器挂载：`apps/lumen/src/editor/editorMount.ts`
- 文档扩展清单：`apps/lumen/src/editor/documentExtensions.ts`

### Playground

- 主要用于 smoke、性能和 dev-tools 联调
- 当前可通过 `?devTools=1` 打开调试面板

## 7. 常用命令

- 安装：`pnpm install`
- 开发：`pnpm dev`
- Lumen 开发：`pnpm dev:lumen`
- 全量构建：`pnpm build`
- 类型检查：`pnpm typecheck`

## 8. 常用排查入口

1. 表格分页、合并、续接问题
   - `packages/extensions/extension-table/src/*`
   - `packages/engine/layout-engine/src/engine.ts`
2. 浮层、mention、bubble-menu 问题
   - `packages/extensions/extension-popup/src/*`
   - `packages/extensions/extension-mention/src/*`
   - `packages/extensions/extension-bubble-menu/src/*`
3. 默认 canvas 渲染问题
   - `packages/engine/render-engine/src/*`
   - `packages/engine/view-canvas/src/view/renderer.ts`
4. 工具栏接线问题
   - `apps/lumen/src/editor/toolbarCatalog.ts`
   - `apps/lumen/src/editor/toolbarActions/*`

## 9. 继续接手建议

1. 先读 `docs/session-handoff.md`
2. 再读本手册第 3-8 节
3. 跑 `pnpm typecheck`
4. 明确要改的是 `lp/core/engine/extension/app` 哪一层
5. 修改后同步更新相关 README 与架构文档
