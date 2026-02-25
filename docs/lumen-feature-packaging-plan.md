# Lumen 功能分包设计（2026-02-25）

## 目标

在继续补齐菜单功能前，先冻结可执行的分包边界，避免逻辑再次回流到单个组件中。

## 治理约束

依据 `governance/package-catalog.json`：

- 依赖方向必须保持：`core -> engine -> extensions -> apps`。
- `apps/lumen` 当前是 `app-only`，产品壳层交互优先留在 app 内。
- 只有跨应用复用且稳定的无头能力，才考虑下沉到 `extensions/engine`。

## 分包决策

### 1）保留在 `apps/lumen` 的功能包

以下属于产品壳层能力，先固定在 app 侧：

- 工具栏动作编排与交互节奏。
- 编辑会话模式（编辑/阅读）与权限体验。
- 打印预览弹层、分享交互等 UI 壳逻辑。
- 菜单编排与 Tab 策略。

目录落点：

- `apps/lumen/src/editor/toolbarActions/*`（动作分域 + 编排）
- `apps/lumen/src/editor/sessionMode.ts`（会话模式模型）
- `apps/lumen/src/editor/toolbarAccessPolicy.ts`（模式感知动作策略）

### 2）候选下沉包（后续阶段）

仅在“跨应用复用 + API 稳定”后下沉：

- `engine` 候选：
  - Canvas 分页采集 + PDF 构建（当前位于 `toolbarActions/export/*`）。
- `extensions` 候选：
  - 无框架依赖的动作策略与动作注册表（不含 Vue/DOM）。

## 下沉准入规则

仅当同时满足以下条件才允许下沉：

1. 不依赖 Vue 组件运行时。
2. 不依赖产品壳层交互（弹层、菜单样式、提示文案节奏）。
3. 至少被两个 app 入口复用（`playground` + `lumen`）或复用确定性很高。
4. 可以抽象为稳定输入输出并独立测试。

## 迁移顺序

1. 先冻结 app 内功能边界（当前阶段）。
2. 在该边界内补齐高频未实现功能。
3. 收集跨 app 重复证据。
4. 再做共享包抽取并同步治理脚本。
5. app 层保留薄适配层处理产品差异。

## 当前首个落地里程碑

按本设计先完成：

- `viewer` 阅读模式动作接线。
- 工具栏在 `edit/viewer` 会话下的动作可用性策略。
