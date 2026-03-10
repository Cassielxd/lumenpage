# LumenPage 包治理清单（2026-03-10）

## 目标

在不破坏现有编辑能力的前提下，收敛包边界、降低依赖复杂度、建立可持续演进机制。

## 当前进度

- [X] 完成目录平铺迁移：`packages/*` 直接平铺，`packages/lp/*` 保留底层内核分组
- [X] 同步 workspace 与应用侧路径解析（`pnpm-workspace.yaml`、`tsconfig`、`vite alias`）
- [X] 完成包标签登记：`governance/package-catalog.json`
- [X] 完成依赖层级校验脚本：`scripts/check-package-governance.mjs`
- [X] 完成 node 包模板校验脚本：`scripts/check-node-package-template.mjs`
- [X] 创建插件聚合包：`packages/editor-plugins`
- [X] 创建分页引擎包骨架：`packages/layout-engine`
- [X] 创建视图运行时包骨架：`packages/view-runtime`
- [X] 完成 `view-canvas` 到 `layout-engine/view-runtime` 的核心接线
- [X] 创建基础节点聚合包：`packages/node-basic`
- [X] 创建媒体节点聚合包：`packages/node-media`
- [X] 完成 `node-basic` / `node-media` 聚合迁移
- [X] 输出保留/合并/拆分清单：`docs/package-governance-inventory.md`
- [X] 修复平铺后 `packages/lp/*` 缺失 `tsconfig.json` 的包内阻塞
- [X] 当前治理校验通过：`node scripts/check-package-governance.mjs`

## 当前分层

- `lp`
  - 底层编辑内核，只向上提供基础能力
- `core`
  - `LumenEditor` 与扩展系统门面
- `engine`
  - 分页、几何、Canvas 运行时
- `extensions`
  - 节点扩展、插件扩展、StarterKit
- `apps`
  - 产品壳

## 关键策略

- `packages/lp/*` 只放底层编辑内核，不再承载分页和渲染引擎
- `packages/core` 作为 Lumen 对外门面，负责 `Editor` 与扩展系统
- `packages/layout-engine` / `packages/view-runtime` / `packages/view-canvas` 与 `core` 平级
- app 侧优先变薄，只保留产品差异和业务壳逻辑

## 当前可验证状态

- `node scripts/check-package-governance.mjs` 通过
- 内部包 typecheck 已通过：
  - `packages/node-basic`
  - `packages/node-list`
  - `packages/node-table`
  - `packages/schema-basic`

## 当前已知剩余阻塞

当前内部路径和包治理已经打通。剩余 typecheck 阻塞主要是环境缺外部依赖，不是这轮包结构错误：

- `w3c-keyname`
- `orderedmap`
- `vue`
- `tdesign-vue-next`
- `tippy.js`

## 下一阶段

1. 把 `history / keymap / inputRules / basicCommands` 收回 `LumenStarterKit` 与 `LumenEditor`
2. 把 `mention / selection bubble` 等插件迁成扩展
3. 继续压大文档分页、滚动、overlay 的同步成本
