# LumenPage 包治理清单（最高优先级）

## 目标

在不破坏现有编辑能力的前提下，收敛包边界、降低依赖复杂度、建立可持续演进机制。

## 当前进度（2026-02-24）

- [X]  完成目录分层迁移：`packages/core`、`packages/engine`、`packages/extensions`、`packages/tooling`
- [X]  同步 workspace 与应用侧路径解析（`pnpm-workspace.yaml`、`tsconfig`、`vite alias`）
- [X]  完成包标签登记：`governance/package-catalog.json`
- [X]  完成依赖层级校验脚本：`scripts/check-package-governance.mjs`
- [X]  完成 node 包模板校验脚本：`scripts/check-node-package-template.mjs`
- [X]  创建插件聚合包：`packages/extensions/editor-plugins`（过渡层）
- [X]  创建分页引擎包骨架：`packages/engine/layout-engine`（从 `view-canvas/layout-pagination` 抽取）
- [X]  创建视图运行时包骨架：`packages/engine/view-runtime`
- [X]  迁移首批纯工具到 `view-runtime`：`segmenter` / `measure` / `pageAlign`（未接线）
- [X]  迁移第二批运行时工具到 `view-runtime`：`virtualization` / `caret` / `posIndex`（未接线）
- [X]  增加运行时同步校验：`scripts/check-view-runtime-sync.mjs`
- [X]  完成首个低风险接线：`view-canvas/view/virtualization` -> `lumenpage-view-runtime`
- [X]  完成低风险接线：`view-canvas/view/segmenter` -> `lumenpage-view-runtime`
- [X]  完成 app 侧 `segmentText` 依赖切换到 `lumenpage-view-runtime`
- [X]  完成 app worker 接线：`LayoutPipeline` 由 `lumenpage-layout-engine` 提供
- [X]  完成 `view-canvas/layout-pagination` 转发到 `lumenpage-layout-engine`
- [X]  新增 `layout-pagination` 转发守护：`scripts/check-layout-engine-redirects.mjs`
- [X]  新增插件聚合导入治理：`scripts/check-plugin-aggregation-imports.mjs`
- [X]  新增旧插件兼容层守护：`scripts/check-plugin-wrapper-redirects.mjs`
- [X]  创建基础节点聚合包：`packages/extensions/node-basic`
- [X]  完成 `node-basic` 合并：`paragraph/heading/blockquote/code-block/hard-break/horizontal-rule` 迁移并由旧包兼容转发
- [X]  新增旧 node 兼容层守护：`scripts/check-node-basic-wrapper-redirects.mjs`
- [X]  创建媒体节点聚合包：`packages/extensions/node-media`
- [X]  完成 `node-media` 合并：`image/video` 迁移并由旧包兼容转发
- [X]  新增媒体 node 兼容层守护：`scripts/check-node-media-wrapper-redirects.mjs`
- [X]  新增 node 测试基线清单：`governance/node-test-baseline.json`
- [X]  新增 node 测试基线校验：`scripts/check-node-test-baseline.mjs`
- [X]  清理 app 侧旧兼容包映射（`vite alias` / `tsconfig paths` 仅保留聚合包）
- [X]  新增 app 配置一致性守护：`scripts/check-app-config-consistency.mjs`
- [X]  输出保留/合并/拆分清单：`docs/package-governance-inventory.md`

## P0（先做，1 周内）

- [X]  给每个包打标签：`public` / `internal` / `app-only`
- [X]  建立依赖层级并锁死（CI 检查）：`core -> engine -> extensions -> apps`
- [X]  输出包清单：`保留 / 合并 / 拆分`

## P1（第二阶段，2-3 周）

- [X]  拆分 `view-canvas`
  - [X]  `layout-engine` 包骨架已建立
  - [X]  `view-runtime` 包骨架已建立
  - [X]  `view-runtime` 代码迁移与接线（`segmenter/measure/pageAlign/virtualization/caret/posIndex/layoutIndex/selectionMovement`）
  - [X]  `view-canvas` 改为组合 `layout-engine + view-runtime`（`layout-pagination` 与核心 view 工具均由新包提供）
- [X]  将零散插件包并入聚合包（实现已迁移到 `editor-plugins`，旧包保留兼容转发层）
- [X]  `node-*` 统一模板（`node-basic` / `node-media` 合并与测试基线已完成）

## P2（第三阶段，1 个月）

- [X]  引入 Changesets（版本/发布可追踪）
- [X]  CI 切换 affected 模式（已接入 `.github/workflows/ci.yml`）
- [X]  建立预算指标：冷构建时间、增量构建时间、依赖深度、公共 API 数量（`governance/perf-budget.json` + `scripts/check-governance-budgets.mjs`）

## 关键策略

- `model/state/transform/...` 这类底层包保持稳定，不轻易拆分
- 优先治理 `view-canvas`（当前职责过多）
- `playground/lumen` 相关功能先在 app 层验证，再下沉到公共包

## 收口项（发布前）

- 在本地非沙箱环境执行 `pnpm governance:budget:measure`，回填 `governance/build-budget-snapshot.json` 的真实时延
- 兼容转发包在 1-2 个版本窗口后评估下线（已增加 `governance:check:merge-adoption`，防止新代码回流依赖旧包）
- CI 已接入 `typecheck:affected` + `build:affected`，并增加 smoke 门禁校验（`governance:check:smoke-gate`）
- 后续可再补浏览器运行态 smoke gate（例如 Playwright 执行 `?allSmoke=1`）
