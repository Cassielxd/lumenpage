# 包治理清单（2026-03-13）

## 说明

- 本文档描述当前仓库实际采用的包分层与治理策略。
- 以 `packages/*` 与 `packages/lp/*` 当前目录为准，不再描述已删除的 `node-*`、`editor-plugins`、`schema-basic` 兼容层。

## 保留（Keep）

| 包名 | 层级 | 说明 |
| --- | --- | --- |
| `lumenpage-model` | core | 文档模型底座 |
| `lumenpage-state` | core | 状态、Selection、Transaction |
| `lumenpage-transform` | core | Step、Mapping、Transform |
| `lumenpage-view-types` | core | 视图层公共类型 |
| `lumenpage-commands` | core | 基础命令能力 |
| `lumenpage-keymap` | core | 键盘映射 |
| `lumenpage-history` | core | 撤销重做历史栈 |
| `lumenpage-inputrules` | core | 输入规则 |
| `lumenpage-collab` | core | 协作能力，当前偏 internal |
| `lumenpage-link` | core | URL 与链接策略 |
| `lumenpage-core` | facade | Editor、Extension、Starter 对外门面 |
| `lumenpage-layout-engine` | engine | 分页、断行、布局、片段清理 |
| `lumenpage-render-engine` | engine | Node/Mark 渲染适配与默认渲染器 |
| `lumenpage-view-runtime` | engine | 几何、定位、虚拟化、选区移动 |
| `lumenpage-view-canvas` | engine | Canvas 视图总入口，整合输入与绘制 |
| `lumenpage-starter-kit` | extensions | 默认扩展装配入口 |
| `lumenpage-markdown` | extensions | Markdown 导入导出 |
| `lumenpage-suggestion` | extensions | suggestion 基础设施 |
| `lumenpage-dev-tools` | tooling | 调试面板，仅开发期使用 |

## 扩展包策略

当前扩展统一采用 `extension-*` 平铺命名，不再保留聚合兼容层。

### 文档结构类

- `extension-document`
- `extension-paragraph`
- `extension-text`
- `extension-heading`
- `extension-blockquote`
- `extension-code-block`
- `extension-hard-break`
- `extension-horizontal-rule`
- `extension-page-break`

### 文本样式类

- `extension-bold`
- `extension-italic`
- `extension-underline`
- `extension-strike`
- `extension-code`
- `extension-text-style`
- `extension-subscript`
- `extension-superscript`

### 列表与表格类

- `extension-bullet-list`
- `extension-ordered-list`
- `extension-list-item`
- `extension-task-list`
- `extension-task-item`
- `extension-table`

### 媒体与工具类

- `extension-image`
- `extension-video`
- `extension-audio`
- `extension-file`
- `extension-bookmark`
- `extension-web-page`
- `extension-math`
- `extension-tag`
- `extension-template`
- `extension-text-box`
- `extension-option-box`
- `extension-columns`
- `extension-callout`
- `extension-signature`
- `extension-seal`
- `extension-embed-panel`

### 编辑行为类

- `extension-smart-input-rules`
- `extension-undo-redo`
- `extension-link`
- `extension-mention`
- `extension-bubble-menu`
- `extension-popup`
- `extension-drag-handle`
- `extension-active-block`
- `extension-block-id`

## 已完成治理项

- 已完成（2026-03-11）：交互能力全部迁入独立 `extension-*` 包，不再保留 `editor-plugins` 聚合层。
- 已完成（2026-03-11）：`starter-kit` 改为聚合装配入口，不再承载底层节点实现代码。
- 已完成（2026-03-12）：`node-*` 聚合设计废弃，统一回到 `extension-*` 平铺结构。
- 已完成（2026-03-13）：空壳目录 `mark-engine`、`extension-schema-basic`、`extension-selection-bubble` 已删除。

## 拆分（Split）

| 当前包 | 拆分目标 | 原因 |
| --- | --- | --- |
| `lumenpage-view-canvas` | `layout-engine` + `render-engine` + `view-runtime` | 当前已形成分层，但 view-canvas 仍承担总装入口职责 |

## 当前结论

- 底层编辑模型保持 `packages/lp/*` 分层。
- 对外门面集中在 `packages/core/core`。
- 渲染链路拆为 `layout-engine`、`render-engine`、`view-runtime`、`view-canvas`。
- 功能扩展统一采用 `extension-*` 平铺目录，尽量向 tiptap 的认知模型靠拢。
