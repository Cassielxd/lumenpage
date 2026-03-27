# LumenPage 架构分析（2026-03-10）

## 范围

- 说明当前有效的分层架构与核心数据流。
- 标注扩展点与边界，避免功能回流到 app 或单个运行时里硬编码。

## 当前分层

### `packages/lp/*`

- 底层编辑内核。
- 当前包含：`model`、`state`、`transform`、`commands`、`keymap`、`inputrules`、`history`、`collab`、`view-types`。
- 这一层只放通用编辑模型与事务基础，不放 Lumen 自己的分页和渲染引擎。

### `packages/core/core`

- 对外提供 `LumenEditor`、`ExtensionManager`、schema 组装、运行时装配。
- 这一层的角色对齐 Tiptap 的 `core`：公开编辑器门面和扩展定义。

### `packages/engine/layout-engine` / `packages/engine/view-runtime` / `packages/engine/view-canvas`

- 这是 Lumen 自己的引擎层。
- `layout-engine` 负责分页布局和复用。
- `view-runtime` 负责几何索引、坐标、命中测试、selection movement。
- `view-canvas` 负责 Canvas 渲染、输入桥接、overlay 调度。
- 这一层不放到 `lp/*` 下面，因为它不是通用编辑内核，而是 Lumen 特有的页面化和 Canvas 运行时。

### `packages/node-*` / `packages/extensions/extension-*` / `packages/core/starter-kit`

- 扩展层。
- 节点扩展、交互扩展、StarterKit 风格组合包都留在这里。

### `apps/*`

- 产品壳。
- 只消费 `core / engine / extensions`，不再手工拼底层 registry 和 view 配置。

## 当前治理边界

- `lp` 只向上提供基础能力。
- `core` 与 `engine` 作为协作层共同组成 Lumen 编辑器。
- `extensions` 依赖 `lp/core/engine`。
- `apps` 只做产品壳装配和业务差异。

## 主链路

1. 输入事件进入 `view-canvas` 输入管线。
2. 事务进入底层状态内核并更新 state。
3. `LumenEditor` 协调 schema、plugins、node registry 和命令门面。
4. `layout-engine` 从文档生成分页布局。
5. `renderer/renderSync` 绘制页面与 overlay。
6. `view-runtime` 保持 `pos/offset/coords` 闭环。

## 当前关键扩展点

- `LumenExtension` / `LumenNodeExtension` / `LumenMarkExtension`
- `LumenExtensionManager`
- Node 侧布局与渲染协议：
  - `toRuns`
  - `layoutBlock`
  - `splitBlock`
  - `renderLine`
  - `createNodeView`
- 视图侧注入：
  - `CanvasEditorViewProps`
  - `selectionGeometry`
  - `nodeSelectionTypes`
  - `plugins`
- 产品侧：`apps/lumen/src/editor/toolbarActions/*`

## 当前结论

1. `LumenEditor` 已经是实际门面，不再只是包壳。
2. `lp/*` 与引擎层边界已经明确：`lp/*` 只放底层内核，分页和 Canvas 运行时继续留在引擎层。
3. app 侧正在从“手工组装 registry/view config”迁移到“传 extensions + editor config”。
4. 大文档性能问题当前仍主要在分页和运行时同步链，不在基础包结构本身。

## 推荐阅读

- `docs/session-handoff.md`
- `docs/large-doc-optimization-handoff-2026-03-09.md`
- `docs/lumen-feature-packaging-plan.md`
- `docs/package-governance-checklist.md`
- `docs/core-style-alignment.md`
