# 会话接手入口（2026-03-10）

## 2026-03-16 更新

- `pnpm typecheck` 已恢复为整仓通过。
- `pnpm governance:check:layers` 已恢复通过。
- `packages/core` 不再从 `view-canvas` 取得 node registry 装配 helper。
- node registry 的真实装配已下沉到 `packages/layout-engine/src/nodeRegistryBuilder.ts`。
- selection geometry 聚合已收回 `packages/core/src/selectionGeometry.ts`。
- pagination worker 的 bootstrap 与 client 协议已集中到 `packages/core`，两个 app 的 worker 入口和 client 都收敛为薄包装。

## 本次继续前先读

1. `docs/large-doc-optimization-handoff-2026-03-09.md`
2. `docs/architecture-analysis.md`
3. `docs/lumen-feature-packaging-plan.md`
4. `docs/package-governance-checklist.md`

## 当前主线

- 大文档性能主线仍然成立：300+ 页输入、回车、滚动继续做增量化。
- 包结构主线已经切到 `core + lp/* + engine + extensions + apps`。
- `lp/*` 只承载底层编辑内核，不承载分页和 Canvas 渲染引擎。
- 当前重点已经转到继续压缩 `view-canvas` 总装职责，并推进 fragment-aware 分页。

## 当前包结构

- `packages/core`
  - `Editor`
  - `ExtensionManager`
  - schema、selection geometry、pagination worker 装配门面
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
- `packages/extension-*` / `packages/starter-kit`
  - 扩展层
- `apps/*`
  - 产品壳

## 这轮已经完成

- 包目录已平铺到 `packages/*`，只保留 `packages/lp/*` 这一层嵌套。
- `pnpm-workspace.yaml`、根 `tsconfig.json`、治理脚本已经同步到新结构。
- `packages/lp/commands`、`packages/lp/history` 等缺失 `tsconfig.json` 的问题已经修复。
- `packages/core` 的 `Editor` 已经成为真实门面，不再只是包壳。
- node registry 装配已下沉到 `layout-engine`，`core` 不再从 `view-canvas` 取装配 helper。
- selection geometry 已收回 `core`，不再由 `view-canvas` 持有唯一实现。
- 两个 app 的 pagination worker 入口和 client 都已瘦身为薄包装，真实协议集中在 `packages/core`。
- 缺失的 workspace 依赖与 TypeScript project references 已补齐到当前主链。

## 当前可验证状态

- `pnpm typecheck` 通过。
- `pnpm governance:check:layers` 通过。
- 主链路已切到 `packages/starter-kit` + `packages/extension-*`，旧的 `node-* / schema-basic / editor-plugins` 已退役。
- 当前剩余工作已不再是“基础依赖缺失”，而是继续推进总装减重与分页引擎第二阶段。

## 下次继续的切入点

1. 继续拆 `packages/view-canvas/src/view/renderSync.ts` 和 `packages/view-canvas/src/view/renderer.ts`，把 orchestration 再往 engine/runtime 下沉。
2. 在新结构上推进分页第二阶段，为 continuation 节点补 `fragmentIdentity / carryState`。
3. 清理源码目录中的历史构建产物与遗留文档路径，避免后续治理漂移。
