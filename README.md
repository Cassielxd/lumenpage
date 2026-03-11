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
- `packages/starter-kit`：默认 schema、命令与节点渲染注册
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

### 6.4 页面样式钩子

- `settings.renderPageBackground(args)`：自定义页面背景/边框绘制（Canvas）。返回 `true` 表示完全接管默认背景。
- `settings.renderPageChrome(args)`：自定义页面装饰绘制（如四角、印章、裁切线）。返回 `true` 表示完全接管默认装饰。
- `settings.onPageCanvasStyle(args)`：自定义页面 DOM 样式（如阴影、圆角、滤镜、边框）。

示例：

```ts
const settings = {
  // ...existing settings
  renderPageBackground: ({ ctx, width, height, drawDefaultBackground }) => {
    drawDefaultBackground();
    ctx.save();
    ctx.fillStyle = "rgba(255, 248, 220, 0.12)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    return true;
  },
  renderPageChrome: ({ ctx, width, height }) => {
    ctx.save();
    ctx.strokeStyle = "#94a3b8";
    ctx.strokeRect(8, 8, width - 16, height - 16);
    ctx.restore();
    return true;
  },
  onPageCanvasStyle: ({ canvas }) => {
    canvas.style.borderRadius = "8px";
    canvas.style.boxShadow = "0 12px 28px rgba(0,0,0,.12)";
  },
};
```

### 6.5 文档 I/O API

`CanvasEditorView` 现提供基础文档读写能力：

- `view.getJSON()`：获取当前文档 JSON 快照。
- `view.setJSON(json)`：将 JSON 文档替换到当前编辑器实例（保留插件与视图实例）。
- `view.getTextContent()`：获取当前纯文本快照。

### 6.6 事务权限（插件实现）

权限控制建议通过状态插件的 `filterTransaction(tr, state)` 实现。

- 返回 `false`：阻断本次事务。
- 返回 `true`：允许事务继续应用。

适用于只读策略、角色权限、敏感节点保护等场景，核心视图层不内置业务权限判断。

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
- `packages/starter-kit`：默认 StarterKit 聚合入口
- `packages/extension-*`：节点、mark、命令与交互扩展
- `packages/drag-handle`：拖拽句柄插件
- `packages/link`：链接解析与安全跳转工具
- `packages/extension-table` / `packages/extension-list-item`：复杂扩展的内部实现入口
- `docs/`：设计文档与差异记录

## 9. 相关文档

- `docs/pos-offset-mapping.md`：`pos <-> offset <-> 坐标` 映射说明
- `docs/prosemirror-gap.md`：历史差异分析与演进记录
- `docs/editor-gap-roadmap.md`：完整编辑器差距清单与补齐路线图

## 10. 完整编辑器差距清单（执行中）

### P0（必须优先）

- 输入法与选区稳定性：IME 合成、跨节点选区、光标不丢失、不跳块。
- 拖拽与选择一致性：文本拖拽、块拖拽、NodeSelection、GapCursor 交互统一。
- 表格编辑完整性：Enter / Backspace / Delete、范围选区、合并拆分、行列增删回归。
- 列表行为一致性：Enter 新项/退出、Backspace 回退层级/转段落、有序无序互切。
- 自动化回归基线：命令级 + 事务映射 + 交互 smoke（键盘/鼠标/拖拽/粘贴）。

### P1（产品可用）

- 粘贴与导入导出：HTML/Markdown/JSON 保真与清洗策略（已接入基础 HTML/Text 粘贴清洗与 JSON 导入导出入口）。
- 历史与协作：Undo/Redo 边界、批事务、远端选区与冲突收敛。
- 只读与权限模型：view-only / 受限编辑 / 评论态。
- 链接与语义交互：编辑态、跳转态、键盘导航、包裹/拆除一致性。
- 移动端触控适配：光标、长按菜单、软键盘遮挡处理。

### P2（规模化）

- 大文档性能压测与优化（分页增量复用、重排范围控制、内存）。
- 无障碍与国际化（键盘可达性、RTL/CJK 混排）。
- 安全治理（粘贴 XSS、URL 策略、媒体资源策略）。
- 插件生态规范（生命周期、兼容矩阵、示例与文档）。

## 11. 回归 Smoke 开关

Playground 支持通过 URL 查询参数开启回归 smoke：

- `?permissionMode=full|comment|readonly`：Playground 权限模式（插件实现）。

说明：
- `full`：正常编辑。
- `comment`：当前与 `full` 一致（预留评论态扩展入口）。
- `readonly`：通过插件阻断文档写入事务，并设置 `editable=false`。

- `?allSmoke=1`：一键执行全套 smoke（推荐本地回归入口）。
- `?tableSmoke=1`：表格导航与命令冒烟。
- `?tableBehaviorSmoke=1`：表格删除/回车严格冒烟（边界删除拦截、范围删除、CellSelection 回车）。
- `?listSmoke=1`：有序列表分页冒烟。
- `?listBehaviorSmoke=1`：列表行为冒烟（段落↔有序/无序切换、列表项 Enter）。
- `?blockOutlineSmoke=1`：块容器几何一致性冒烟（`code_block` / `blockquote`）。
- `?dragSmoke=1`：拖拽/选择链路冒烟（`resolveDragNodePos`、dropCursor、媒体 NodeSelection）。
- `?dragActionSmoke=1`：真实内部拖拽动作冒烟（文本 + 媒体节点的 `start -> update -> finish` 移动）。
- `?selectionImeSmoke=1`：选区/中文输入路径冒烟（文本插入、映射回环、NodeSelection 往返）。
- `?imeActionSmoke=1`：真实组合输入事件冒烟（composition start/update/end + beforeinput）。
- `?selectionBoundarySmoke=1`：节点选区/间隙选区边界冒烟（GapCursor 与 NodeSelection 往返）。
- `?toolSmoke=1`：工具栏命令冒烟（加粗/斜体/下划线/链接/标题段落切换）。
- `?pasteSmoke=1`：真实粘贴事件冒烟（plain text + HTML）。
- `?historySmoke=1`：历史栈冒烟（插入后 undo/redo 可逆）。
- `?mappingSmoke=1`：`pos <-> offset` 映射冒烟（roundtrip 与单调性）。
- `?coordsSmoke=1`：`coordsAtPos/posAtCoords` 命中回环冒烟。
- `?readonlySmoke=1`：只读态冒烟（输入与内部拖拽阻断）。
- `?docRoundtripSmoke=1`：文档 JSON 往返冒烟（`toJSON -> nodeFromJSON`）。
- `?markdownIoSmoke=1`：Markdown 解析/序列化回环冒烟（`parse -> serialize -> parse`）。

Playground 额外能力：

- 工具栏提供 `导入JSON/导出JSON`（基于 `CanvasEditorView.setJSON/getJSON`）。
- 工具栏提供 `导入HTML/导出HTML`（基于 schema DOM parser/serializer）。
- 工具栏提供历史边界控制：`切分历史`（`closeHistory`）与 `Undo/Redo depth` 显示。
- 粘贴链路接入 `transformPastedText/transformPastedHTML`：
  - 统一换行与空格（`CRLF -> LF`，`NBSP -> 空格`）。
  - 清洗危险标签与事件属性（移除 `script/style/iframe/...`、`on*`、`javascript:` URL）。
- 链接交互区分编辑态与跳转态：
  - `full/comment`：`Ctrl/Cmd + 点击` 才跳转，普通点击用于编辑。
  - `readonly`：单击直接跳转。
  - 键盘支持 `Ctrl/Cmd + Enter`：当光标位于链接内时直接跳转。

建议联调参数：

```txt
?devTools=1&tableSmoke=1&tableBehaviorSmoke=1&listSmoke=1&listBehaviorSmoke=1&blockOutlineSmoke=1&dragSmoke=1&dragActionSmoke=1&selectionImeSmoke=1&imeActionSmoke=1&selectionBoundarySmoke=1&toolSmoke=1&pasteSmoke=1&historySmoke=1&mappingSmoke=1&coordsSmoke=1&readonlySmoke=1&docRoundtripSmoke=1
```

或直接：

```txt
?devTools=1&allSmoke=1
```

`allSmoke=1` 执行后会附加一条汇总日志：

- `[all-smoke-summary] total=... pass=... fail=...`
