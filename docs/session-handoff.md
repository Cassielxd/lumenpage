# 会话接手入口（2026-03-10）

## 本次继续前先读

1. `docs/large-doc-optimization-handoff-2026-03-09.md`
2. `docs/architecture-analysis.md`
3. `docs/lumen-feature-packaging-plan.md`
4. `docs/package-governance-checklist.md`

## 当前主线

- 大文档性能主线仍然成立：300+ 页输入、回车、滚动继续做增量化。
- 包结构主线已经切到 `core + lp/* + engine + extensions + apps`。
- `lp/*` 只承载底层编辑内核，不承载分页和 Canvas 渲染引擎。

## 当前包结构

- `packages/core`
  - `LumenEditor`
  - `ExtensionManager`
  - schema 与运行时装配门面
- `packages/lp/*`
  - `model`
  - `state`
  - `transform`
  - `commands`
  - `keymap`
  - `inputrules`
  - `history`
  - `collab`
  - `view-types`
- `packages/layout-engine` / `packages/view-runtime` / `packages/view-canvas`
  - Lumen 自己的分页、几何、Canvas 运行时
- `packages/node-*` / `packages/kit-basic` / `packages/editor-plugins`
  - 扩展层
- `apps/*`
  - 产品壳

## 这轮已经完成

- 包目录已平铺到 `packages/*`，只保留 `packages/lp/*` 这一层嵌套。
- `pnpm-workspace.yaml`、根 `tsconfig.json`、治理脚本已经同步到新结构。
- `packages/lp/commands`、`packages/lp/history` 等缺失 `tsconfig.json` 的问题已经修复。
- `LumenEditor` 已经成为真实门面，不再只是包壳。
- 两个 app 都改成通过 `LumenEditor` 装配 schema、node registry、selection geometry、plugins。

## 当前可验证状态

- `node scripts/check-package-governance.mjs` 通过。
- 内部包 typecheck 已通过：
  - `packages/node-basic`
  - `packages/node-list`
  - `packages/node-table`
  - `packages/schema-basic`
- 剩余阻塞主要是当前环境缺外部依赖，不是这轮结构改造错误：
  - `w3c-keyname`
  - `orderedmap`
  - `vue`
  - `tdesign-vue-next`
  - `tippy.js`

## 下次继续的切入点

1. 把 `history / keymap / inputRules / basicCommands` 继续收进 `LumenStarterKit` 和 `LumenEditor`。
2. 把 `mention / selection bubble` 继续迁成 `LumenExtension`。
3. 在新结构上继续推进大文档分页和滚动性能优化。
