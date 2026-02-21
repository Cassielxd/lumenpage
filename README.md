# LumenPage

LumenPage 是一个基于 Canvas 的分页富文本编辑器框架，面向“长文档、强排版、可扩展”的在线编辑场景。  
它不是简单复刻 `contenteditable`，而是把文档模型、分页布局、渲染管线做成可控系统，目标是提供稳定的分页结果、可预测的性能与清晰的扩展边界。

## 产品介绍

LumenPage 面向“在线文档/报告编辑”场景，提供接近桌面文档软件的分页编辑体验。  
用户可以在同一编辑器中完成正文撰写、图文混排、表格编辑、样式排版与结构化内容组织，并在长文档场景下保持稳定排版与流畅交互。

当前产品形态重点解决三件事：

- 分页稳定：长文档编辑时，页面断点与布局结果可预测、可复用。
- 交互一致：文本、块节点、表格、媒体等不同内容类型在同一交互模型下工作。
- 能力可扩展：新节点、新工具、新交互可以通过插件化方式接入，不需要改动大量核心逻辑。

## 为什么选择 LumenPage

- 分页是编辑时能力，不是导出后补救：A4 页面、页边距、跨页行为在编辑过程中实时可见。
- 架构思想灵感来源于 ProseMirror：命令与插件模型清晰，同时结合 Canvas 分页渲染能力，覆盖长文档场景需求。
- 长文档性能更可控：渲染与布局分层，基于布局结果做命中、选区和增量重绘，减少复杂 DOM 带来的抖动。
- 架构更易演进：核心最小化，业务能力优先放插件/扩展包，降低核心耦合和回归风险。
- 落地效率更高：文本、表格、图片、视频、拖拽、分页等能力可直接组合成文档产品基础设施。

## 典型使用场景

- 在线报告编辑：行业报告、研究报告、项目复盘等需要分页预览和稳定排版的文档场景。
- 教培与考试：讲义、作业、试卷等结构化内容，强调表格、图文混排与打印一致性。
- 企业知识文档：制度文档、SOP、模板化文档，要求多人协作下样式和结构可控。
- 内容生产后台：媒体稿件、运营手册、产品文档，要求长文档编辑性能稳定。
- 行业垂直文档：法律、医疗、财务等高规范文本，关注可追溯、可导出、可复用版式。

## 扩展的产品想象

- 模板中心：沉淀行业模板（报告、合同、制度、试卷）并支持一键套版。
- 变量文档：支持占位符变量与批量生成，连接业务系统生成个性化文档。
- 协同与审阅：评论、批注、建议模式、版本比对，形成完整审阅闭环。
- 智能辅助：大纲生成、内容润色、结构检查、术语统一等 AI 能力按插件接入。
- 输出与分发：导出 PDF/图片/可打印版本，并支持文档发布、分享与权限控制。
- 业务组件市场：表单块、审批块、数据图表块等领域组件通过扩展包接入。

## 1. 项目定位

- 编辑模型：架构思想灵感来源于 ProseMirror（`schema/state/transform/commands` 思想）。
- 视图实现：使用 Canvas 进行渲染，DOM 仅承担事件桥接与少量 overlay。
- 业务方向：面向“文档编辑 + 分页排版 + 可扩展节点能力”。

## 2. 核心设计思路

### 2.1 核心最小化

- 核心只做：
  - 状态流转（transaction -> state）
  - 分页布局（layout）
  - 渲染与命中（render/hit-test）
  - 输入与选区桥接
- 能抽到扩展点的尽量抽到插件 `props`：
  - `nodeViews`
  - `dropCursor` / `createDropCursorDecoration`
  - `resolveDragNodePos`
  - `getText`
  - `parseHtmlToSlice`
  - `isInSpecialStructureAtPos`
  - `shouldAutoAdvanceAfterEnter`
  - `nodeSelectionTypes`
  - `onChange`

### 2.2 分层架构

- `packages/view-canvas`：Canvas 视图层（输入、选区、渲染、分页、事件编排）
- `packages/kit-basic`：默认 schema、命令与节点渲染注册
- `packages/node-*`：节点级能力（paragraph/heading/list/table/image/video/...）
- `packages/drag-handle`：块级拖拽句柄插件（含 drop cursor 默认实现）
- `apps/playground`：演示与联调入口

### 2.3 插件优先策略

- 优先读取插件/props，旧配置（`CanvasConfig`）作为兼容回退。
- 多插件冲突时采用“顺序优先”（先注册先命中）的策略。
- 对于事件监听类（如 `onChange`），支持多插件同时触发。

## 3. 技术栈

- 语言：TypeScript
- 工作区：pnpm workspace
- 构建：Vite + `tsc -b`
- 渲染：Canvas 2D
- 编辑模型：借鉴 ProseMirror 的状态流转与命令体系
- UI：Vue 3 + TDesign（playground）

## 4. 运行与构建

```bash
pnpm install
pnpm dev
```

```bash
pnpm -r typecheck
pnpm -r build
```

仅构建演示应用：

```bash
pnpm build:app
```

## 5. 主要功能清单（当前状态）

- 文本编辑：段落/标题/加粗/斜体/下划线/删除线/行内代码/链接
- 块级结构：引用、代码块、分割线、列表（有序/无序）
- 媒体节点：图片、视频
- 表格：加删行列、单元格合并/拆分、单元格范围选区渲染
- 历史与输入：undo/redo、keymap、inputrules、gapcursor
- 分页：A4 尺寸、页边距、跨页布局、增量复用
- 拖拽：文本与块拖拽、drop cursor、拖拽句柄插件化

## 6. 关键实现机制

### 6.1 渲染管线

- `state -> layout -> render -> overlay`
- line 级布局数据用于：
  - 文本定位
  - 选区矩形
  - 节点 overlay 同步
  - 命中测试

### 6.2 选区机制

- 文本选区：基于 offset 与布局行映射
- NodeSelection：可按插件配置控制可选节点类型
- 表格选区：支持 cell 范围背景高亮（不仅文本高亮）

### 6.3 拖拽机制

- Canvas 环境下采用“手势内部拖拽 + 原生拖拽兼容”双路径
- 块级拖拽位置解析由插件 `resolveDragNodePos` 决定
- drop cursor 默认由 `drag-handle` 插件提供，可覆盖/禁用

## 7. 架构思想（灵感来源）

- 架构设计灵感来源于 ProseMirror：
  - `command` 保持函数式组合（不强行塞进 props 通道）
  - `props` 用于视图行为扩展与事件接管
  - `plugin` 负责可插拔能力（nodeView/拖拽/装饰等）
- Canvas 特有能力保留在视图层：
  - 分页布局
  - 坐标与命中映射
  - 高性能重绘策略

## 8. 仓库结构

- `apps/playground`：演示应用
- `packages/view-canvas`：Canvas EditorView 与分页布局引擎
- `packages/kit-basic`：默认 schema + commands + registry
- `packages/drag-handle`：拖拽句柄插件
- `packages/node-*`：节点实现包
- `docs/`：设计文档与差异记录

## 9. 相关文档

- `docs/pos-offset-mapping.md`：`pos <-> offset <-> 坐标` 映射说明
- `docs/prosemirror-gap.md`：历史差异分析与演进记录
