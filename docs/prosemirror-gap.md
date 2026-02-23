# LumenPage 与 ProseMirror 差异说明

## 目标

本文记录 LumenPage 在“保持 ProseMirror 数据/事务思想”前提下，为 Canvas 分页编辑场景做的工程化扩展。

## 核心共性

- 保留 `model/state/transform/commands` 的分层思路。
- 事务驱动状态更新，插件负责能力扩展。
- 命令模型与 keymap 组合方式保持一致。

## 主要差异

### 1. 视图层

- ProseMirror 默认 DOM 视图；LumenPage 使用 `packages/view-canvas` 提供 Canvas 分页视图。
- 额外引入 `docPos <-> textOffset <-> coords` 三向映射，支持光标与命中定位。

### 2. 布局模型

- ProseMirror 以文档流为主；LumenPage 增加分页布局引擎：
  - `LayoutPipeline.layoutFromDoc`
  - `pages -> lines` 结构化布局产物
  - 页级缓存与增量失效

### 3. 渲染模型

- ProseMirror 以 DOM patch 为主；LumenPage 采用：
  - 页面内容缓存（page canvas）
  - overlay 动态层（选区、光标、装饰）
  - 可见页虚拟化与增量重绘

### 4. 输入与交互

- 保留命令/事务语义，但输入桥接转为 Canvas 事件管线：
  - pointer/touch/drag 统一入口
  - NodeSelection 与 GapCursor 的命中策略
  - 拖拽句柄插件化（`packages/drag-handle`）

### 5. 扩展点

- ProseMirror 的 `props/plugin` 体系仍可用。
- LumenPage 新增 Canvas 专属扩展点：
  - `selectionGeometry`
  - `createDropCursorDecoration`
  - `offsetMapping`
  - `paginationWorker` 配置

## 迁移与兼容策略

- legacy 策略入口持续收敛到 `EditorProps / Plugin props`。
- `legacyPolicy.strict=true` 时禁止旧入口，避免多通道并存。
- 安全策略（链接/媒体）已下沉到 `packages/link`，在解析与导入链路统一生效。

## 参考文档

- `docs/editor-gap-roadmap.md`
- `docs/pagination-layout.md`
- `docs/pos-offset-mapping.md`
