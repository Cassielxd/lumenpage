# Core 风格对齐说明（2026-03-27）

## 目标

- 把 `packages/core/core` 收敛成更接近 Tiptap `packages/core` 的组织风格。
- 不做“削平 Lumen 特性”的纯移植。
- 先冻结当前可用行为，再做分层和命名对齐。

## 当前结论

- `packages/core/core` 是对标 Tiptap `core` 的正确目标。
- `packages/engine/view-canvas` 仍然是 Lumen 自己的 Canvas 运行时，不应该被误收敛进 `lp/*` 或纯 headless core。
- 这次重构的主线不是补更多功能，而是把现有能力整理成：
  - `Editor / Extension / Node / Mark`
  - `commands / extensions`
  - `helpers / utilities`
  - `bridge/canvas`

## 已完成的结构对齐

- 从大文件内联逻辑中抽出 `helpers/` 与 `utilities/`。
- `ExtensionManager` 现在主要承担 facade / orchestration 角色。
- schema 组装已经拆成 helper 组合，不再由 `schemaFields.ts` 独占实现。
- Canvas 相关桥接下沉到 `bridge/canvas/`，旧路径继续保留兼容 re-export。
- 根入口已经补齐 `helpers`、`utilities` namespace 风格导出。

## 明确保留的 Lumen 特性

这些不是临时实现细节，而是稳定协议。风格对齐不能破坏它们：

- `layout()` / `canvas()` / `renderPreset`
- `addMarkAdapter()` / `addMarkAnnotation()`
- `dispatchTransaction()` / `extendState()`
- `ExtensionContext.schema` / `ExtensionContext.nodeRegistry`
- `Editor.view`、`Editor.nodeRegistry`、`Editor.selectionGeometry`
- `PaginationDocWorkerClient`
- `attachExtensionPaginationDocWorker`
- paste / clipboard transform 管线

## 当前 characterization 护栏

位置：

- `packages/core/core/tests/extension-manager.characterization.test.mjs`
- `packages/core/core/tests/canvas-bridge.characterization.test.mjs`
- `packages/core/core/tests/editor.characterization.test.mjs`
- `packages/core/core/tests/core-events.characterization.test.mjs`
- `packages/core/core/tests/command-manager.characterization.test.mjs`
- `packages/core/core/tests/paste-rule.characterization.test.mjs`

运行入口：

- `node ./packages/core/core/tests/run-characterization-tests.mjs`
- `pnpm test:core:characterization`

当前覆盖面：

- `ExtensionManager` 的扩展解析、schema/layout/canvas 聚合、clipboard/transform 管线、runtime 注入
- `Editor` 的生命周期、`setOptions` / `setEditable`、dispatch/capture 路径
- core `focus/blur/paste/drop/beforeInput` 事件链
- `CommandManager` 的 `commands / chain / can / run / withRuntime`
- `PasteRule` 和 `text/mark/nodePasteRule`
- selection geometry 与 pagination worker client

## 当前已锁住的几个“真实语义”

这些地方不是理想化假设，而是现状行为；后续要么保持，要么显式升级：

- `configure()` 对默认 `options` 是浅覆盖，不是深并。
- `chain().run()` 即使链中存在失败命令，当前实现仍会执行最终 dispatch。
- `commands.run()` 对 editor command 走工厂式调用；对 legacy command 直接执行。
- option listeners 会先于 extension hooks 绑定；extension hooks 再按 priority 降序执行。

## 推荐的后续顺序

1. 继续保持“先加 characterization，再做结构调整”。
2. 如果继续瘦身 `core`，优先做 helper/utility 内聚，不要先动协议。
3. 如果要补新 API，优先补和现有 Lumen 协议一致的 facade，不要为了像 Tiptap 而硬删 Canvas/runtime 通道。
4. 只有在 characterization suite 覆盖到位后，才考虑进一步收敛 public surface。
