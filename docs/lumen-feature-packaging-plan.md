# Lumen 功能分包设计（2026-03-10）

## 目标

在继续补齐功能前，先冻结当前可执行的分包边界，避免逻辑再次回流到 app 或单个运行时里。

## 当前包结构

- `packages/core`
  - `LumenEditor`
  - `ExtensionManager`
  - schema 与运行时门面
- `packages/lp/*`
  - 底层编辑内核：`model/state/transform/commands/keymap/inputrules/history/collab/view-types`
- `packages/layout-engine`
  - 分页布局与页复用
- `packages/view-runtime`
  - 几何索引、坐标、selection movement、命中测试
- `packages/view-canvas`
  - Canvas 渲染、输入桥接、overlay 调度
- `packages/node-*` / `packages/editor-plugins` / `packages/kit-basic`
  - 扩展层
- `apps/*`
  - 产品壳

## 包边界结论

### 保留在 `apps/lumen` 的能力

以下仍然属于产品壳层，暂不下沉：

- 工具栏动作编排与交互节奏
- 编辑/阅读会话模式与权限体验
- 打印预览、分享交互等 UI 壳逻辑
- 菜单编排与 Tab 策略

目录落点：

- `apps/lumen/src/editor/toolbarActions/*`
- `apps/lumen/src/editor/sessionMode.ts`
- `apps/lumen/src/editor/toolbarAccessPolicy.ts`

### 保留在 `packages/lp/*` 的能力

只保留通用编辑内核：

- 文档模型
- 状态与事务
- 变换
- 命令、快捷键、input rules、history、collab

### 明确不放到 `packages/lp/*` 的能力

以下保持和 `core` 平级，不再错误地下沉到 `lp/*`：

- 分页布局引擎
- `LayoutSnapshot` / 运行时几何索引
- Canvas 渲染与输入桥接
- Lumen 自己的分页复用策略

原因：这些都不是通用编辑内核，而是 Lumen 的页面化和 Canvas 运行时能力。

## 当前已完成的迁移

- 包目录已经平铺，除 `lp/*` 外其余包都和 `core` 平级。
- `LumenEditor` 已经负责 schema、node registry、selection geometry、plugins 的装配。
- app 侧不再手工创建默认 node registry。
- `dragHandle` 已经改成扩展接入。
- `LumenStarterKit` 已经成为扩展组合入口之一。

## 当前剩余工作

1. 把 `history / keymap / inputRules / basicCommands` 继续收进 `LumenStarterKit` 和 `LumenEditor`。
2. 把 `mention / selection bubble` 等插件继续迁成 `LumenExtension`。
3. 在新结构上继续推进大文档分页和滚动性能优化。

## 下沉准入规则

仅当同时满足以下条件才允许从 app 下沉：

1. 不依赖 Vue 组件运行时。
2. 不依赖产品壳层交互节奏。
3. 至少被两个 app 入口复用，或者复用确定性很高。
4. 可以抽象成稳定输入输出并独立测试。
