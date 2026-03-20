# Lumen 菜单产品完成收口方案（2026-02-27）

- 统计来源：`apps/lumen/src/editor/toolbarCatalog.ts` + `apps/lumen/src/editor/toolbarActions/*`
- 说明：本文件是“产品态收口”口径，不等同于 `implemented=true` 的“接线口径”。

## 1. 口径定义

### 接线完成（Engineering Wired）

- 菜单项在 `toolbarCatalog.ts` 中 `implemented=true`
- 对应 action 已可触发

### 产品完成（Product Complete）

单项必须同时满足：

1. 无 `window.prompt/alert` 主流程依赖。
2. 无占位式回退（如仅插纯文本占位而非真实节点能力）。
3. 在只读/权限模式下行为一致。
4. 有可重复验证路径（smoke 或明确手工回归用例）。

## 2. 工程接线现状（2026-03-19）

- `docs/lumen-menu-feature-checklist.md` 现已按 `toolbarCatalog.ts` 自动同步
- 当前工程接线统计：`102 / 102`
- 其中工具域的 `diagrams`、`echarts`、`mermaid`、`mind-map` 已完成接线
- 历史基线里的 `seal` 仍是扩展能力，但已不在当前 Lumen 工具栏目录中，因此菜单总数从 `103` 调整为 `102`
- 本文后续仍按“产品完成”口径跟踪，不等同于单纯 `implemented=true`

## 3. 历史基线（2026-02-27）

- 菜单总项：`103`
- 接线完成：`99`
- 未接线：`4`

当前未接线项：

- `diagrams`
- `echarts`
- `mermaid`
- `mind-map`

说明：

- 顶部 `export` Tab 按产品策略默认隐藏，但导出能力仍在“开始”区复用。
- 实时接线清单以 `docs/lumen-menu-feature-checklist.md` 为准。

## 4. 产品收口优先级

### P0：完成 4 项未接线能力

1. `diagrams`：流程图节点/渲染能力（非仅源码块占位）。
2. `echarts`：图表配置与可视化渲染。
3. `mermaid`：源码编辑 + 渲染容器。
4. `mind-map`：源码编辑 + 渲染容器。

### P1：统一交互壳并去占位化

1. 工具域动作统一走面板交互，不走原生弹窗。
2. 工具节点输出优先使用结构化节点，不回退纯文本占位。
3. 明确在线依赖（二维码/条码）与离线降级策略。

### P2：回归与质量门禁

1. 给新增/改造能力补 smoke 或脚本化断言。
2. 在 `readonly/comment/full` 三种模式下补行为回归。
3. 每次交付同步更新本文件和 `lumen-menu-feature-checklist.md`。

## 5. 验收 DoD（单项）

- [ ] 接线完成且命令可触发
- [ ] 无 `window.prompt/alert` 主流程
- [ ] 无占位 fallback 文本方案
- [ ] 权限模式行为正确
- [ ] 有回归用例（自动或手工脚本）
