# LumenPage 编辑器差距路线图（已修复乱码）

## 目标

把当前 Canvas 编辑器从“可用”推进到“稳定可交付、可规模化演进”。
优先级始终是：交互一致性 > 回归可控性 > 性能可预测性 > 扩展生态。

## 快速接手入口（新增）

- 下次继续开发前先读：`docs/session-handoff.md`
- 该文档维护了当前未提交改动、验证命令与下一步优先级，作为会话级入口。

## 最高优先级（当前主线）

- 包治理与分层收敛已提升为当前最高优先级，执行清单见：
  - `docs/package-governance-checklist.md`
- 执行约束：
  - 底层核心包（`model/state/transform/...`）稳定优先，不做高频拆分。
  - 优先治理 `view-canvas` 的职责过载问题。
  - `playground/lumen` 能力先在 app 层验证，再决定是否下沉到公共包。

## 当前阶段（截至 2026-02-23）

- 已完成一轮核心重构：`EditorView` 模块化拆分、NodeView 管理、拖拽句柄插件化、A4 分页样式落地。
- 已建立 Smoke 回归体系：P0 套件、`allSmoke` 汇总、`perfBudgetSmoke` 性能预算冒烟。
- P2 的“大文档性能优化”已完成代码层落地，路线图进入下一段：无障碍/国际化、安全治理、插件生态规范化。

## 架构深度分析（现状）

### 1. 分层与模块边界

- `packages/model` / `packages/state` / `packages/transform` / `packages/commands`：ProseMirror 思想的 headless 核心能力。
- `packages/engine/view-canvas`：Canvas 视图实现，负责输入、布局、渲染、命中、坐标映射。
- `packages/core/starter-kit` + `packages/extensions/extension-*`：默认 schema、命令、节点/mark/交互扩展注册。
- `packages/extensions/extension-*`：节点级与交互级扩展（paragraph、heading、list、table、image、video 等）。
- `apps/playground`：集成入口、调试面板、Smoke 触发与回归汇总。

### 2. 关键数据流

1. DOM 输入事件进入 `inputPipeline`。
2. 事件统一转为命令或事务，交给 `stateFlow`。
3. `changeSummary` 计算最小变更范围，驱动增量布局策略。
4. `LayoutPipeline.layoutFromDoc` 产出 `pages -> lines`。
5. `Renderer` 做可见页虚拟化、签名缓存与增量重绘。
6. overlay 层绘制选区、装饰、光标；NodeView overlay 独立同步。
7. `docPos <-> textOffset <-> coords` 映射闭环支撑命中与编辑。

### 3. 细节设计亮点

- offset 映射下沉到节点 spec（`offsetMapping`），不是在核心里写死节点分支。
- 分页层同时具备三类性能手段：块缓存、页面复用、渐进布局（progressive）。
- 渲染层区分“页面内容缓存”和“overlay 动态层”，避免整页重绘。
- worker 分页采用“安全门禁 + 回退策略”，复杂块（如表格）自动回退主线程，保证正确性优先。
- NodeView 管理与主渲染解耦，支持媒体 DOM overlay 与 Canvas 文本同屏协同。

### 4. 已识别风险（持续跟踪）

- 文档编码问题已收敛：`docs/pagination-layout.md` 已重写为 UTF-8 正常版本。
- 文档索引漂移已修复：`docs/prosemirror-gap.md` 已补齐，README 链接恢复有效。
- 临时文件风险已清理：`packages/model/src/tmpclaude-*` 已移除。
- 严格模式迁移已开始，但仍有 legacy 通道依赖风险，需要持续收口。

## 路线图（更新版）

## P0（必须项，持续守护）

1. 输入法与选区稳定性。
2. 拖拽与选择一致性。
3. 表格行为完整性。
4. 列表行为一致性。
5. 自动化回归基线（P0/All Smoke）。

状态：已具备可回归能力，后续以“防回退”为主，不再大规模加特性。

### P0.x 列表项嵌套复杂块补齐（待完善，2026-03-14）

问题定义：

- 当前 schema/model 与 ProseMirror 规则基本对齐：`listItem` 是 `block+`，`table` 属于 `block`，因此 `list item -> table` 在文档模型上是合法结构。
- 当前 Canvas 渲染链路没有把这条能力补齐。`list` renderer 会先递归布局 item 子树，但在回写布局结果时把子块 line 统一改写为 list 自己的渲染身份，导致 nested `table`、`codeBlock` 等依赖自身 `renderLine` / `splitBlock` 的块无法完整工作。
- 当前可见表现预计为：文本内容可能仍能出现，但表格边框、背景、跨页续接、选择几何与命中行为都不可靠；当单个 item 自身过高时，还会与 list 自己的分页切分逻辑冲突。

根因拆解：

1. 当前绘制派发是单一的 `line.blockType -> renderer.renderLine`，不支持“父级列表 marker + 子级真实 renderer”组合绘制。
2. `list` 目前是“复合叶子块”，分页由 `splitListBlock` 独占；当单个 item 高度超过可用页高时，会退化为按 line 高度切分，而不是向 nested `table` 委托 `splitBlock`。
3. `table`、`codeBlock`、`image`、`video` 等复杂块都依赖各自的渲染契约；一旦 child identity 被 list 吞掉，子块的专有渲染与分页能力就无法自然生效。

实施原则：

- 不调整 ProseMirror 层 schema 合法性；问题只在 `layout/render` 层补齐。
- 先修复“child renderer identity 丢失”，再补“父子块分页委托”。
- 尽量沉淀成可复用协议，不把 `view-canvas` 核心写死成只为 `list -> table` 服务的临时分支。

阶段 A：先恢复渲染正确性

1. list 布局结果保留 child line 的真实 `blockType`、`blockId` 与专有 meta；list 只附加 `listMarker`、`listMeta`、`ownerList*` 之类的父级信息，不再覆盖 child renderer identity。
2. 渲染阶段增加父级列表装饰绘制能力，使一条 line 可以同时拥有“父级 marker”与“子级真实渲染”。
3. 阶段 A 的目标是先让 `listItem -> table/codeBlock/image/video/blockquote` 在单页内显示正确，不在本阶段重写整套 list 分页协议。

阶段 B：补齐分页与续接

1. `splitListBlock` 先按 item 边界切分，再按 child block 边界切分。
2. 当 item 内某个 child block 自身过高且声明了 `splitBlock` 时，list 向 child renderer 委托切分，再把 visible/overflow 结果重新包回 item 级 fragment。
3. continuation 策略单独定义：第一页保留 marker；续页是否显示 continuation marker 作为明确规则而不是副作用。
4. table 进入 list 后仍需保留自己的 row-level continuation、续接 meta 与选择几何能力。

影响评估：

- 阶段 A 对分页算法影响有限，主要改 line identity 与绘制顺序，风险中等偏低。
- 阶段 B 会实质修改 `splitListBlock` 行为，对分页、页复用、增量布局与回归面都有影响，风险中等偏高。
- 本项完成后需要补专门回归：`list -> table` 单页渲染、`list -> table` 跨页分页、`list -> codeBlock`、nested list、拖拽、命中、选区与光标移动。

建议落地顺序：

1. 先做阶段 A，只解决 child renderer identity 被 list 吞掉的问题。
2. 阶段 A 稳定后，再做阶段 B，把 nested complex block 的 split 委托机制补齐。
3. 阶段 B 收口后，再评估是否把相邻问题一并纳入，如 `tableCell -> image/video/custom block`。

相关实现位置：

- `packages/engine/render-engine/src/defaultRenderers/list.ts`
- `packages/engine/render-engine/src/defaultRenderers/table.ts`
- `packages/engine/render-engine/src/defaultRenderers/codeBlock.ts`
- `packages/engine/view-canvas/src/view/renderer.ts`
- `packages/engine/view-canvas/src/defaultRenderers/tablePagination/split.ts`

### P0.y 参考 HTML 分层的 box/fragment 迁移清单（进行中，2026-03-15）

目标：

- 把当前“`lines` 为主、`boxes/fragments` 为派生”的过渡架构，逐步迁到更接近 HTML 渲染分层的模式：
  - `doc tree`
  - `box tree`
  - `fragment tree`
  - `paint/display list`
- 迁移过程保持功能可用，优先做“单一物化入口、单一几何语义、单一分页协议”，避免一次性推翻。

当前判断：

- 已经有 `page.boxes`、`page.fragments` 和 `renderFragment`，但三者还不是主模型。
- 顶层分页和文本交互仍然大量依赖 `page.lines`。
- 渲染仍是“fragment 递归 + line 平铺”的混合模式。

未完成任务清单：

1. 统一 page 几何物化入口。
   - 目标：`engine`、`renderer`、索引层都通过同一个 helper 物化 `boxes/fragments`，不再各自从 `lines` 重建。
   - 状态：已完成。`pageGeometry` 已成为统一入口。

2. 让 `page.boxes` 成为布局阶段的一等产物。
   - 目标：减少“先 layout lines，再反推 box”的依赖，让 box 成为稳定的布局输出。
   - 风险控制：先保持 `lines` 继续产出，只把 box 生成前移，不立即删除 line 依赖。
   - 状态：已完成第一阶段。布局放线时已同步收集 box，仍保留从 `lines` 重建的兼容兜底。

3. 让 `page.fragments` 成为唯一的复杂块渲染入口。
   - 目标：复杂块 chrome、容器绘制、叶子视觉块都统一走 `renderFragment`。
   - 保留项：文本叶子暂时仍允许保留 `line` fallback，但要收敛到 `TextLineFragment` 语义。
   - 状态：进行中。已把纯 fragment 视觉块从 line body pass 中剥离，line body pass 也已下沉成明确的“叶子文本兼容层”；仍保留文本/辅助视觉的 line pass。

4. 把文本叶子从“纯 line”升级成“leaf fragment + line index”双层模型。
   - 目标：渲染主入口、命中、选区最终都围绕 leaf fragment；`line` 只保留给文本测量和快速索引。
   - 风险控制：先做索引和渲染入口调整，不同步改所有编辑算法。
   - 状态：进行中。`page.boxes/page.fragments` 已开始生成 `text-line` 叶子，渲染递归阶段会优先消费这些文本 fragment；`line` pass 仍保留为未命中文本 fragment 的兼容兜底。默认几何查询与 box 索引仍保持 block-first，`text-line` 叶子单独隔离在过渡索引里，避免干扰现有 block 级命中与选区；文本装饰、普通文本选区、indexed 文本移动链，以及带 `layoutIndex` 的 `coordsAtPos/posAtCoords/getHitAtCoords` 路径都已经开始优先走这层叶子索引。当前 `paragraph/heading/list` 这类正文仅依赖 `defaultRender` 的文本块已切到 `text-line fragment` 主路径，复杂块的 `renderLine` 仍保留在兼容层。

5. 统一分页协议。
   - 目标：从“顶层 line 分页 + 局部 splitBlock 委托”过渡到“容器递归分页 + legacy splitBlock 兼容”。
   - 阶段要求：先明确 container/leaf 的分页职责，再逐步替换现有 `splitBlock` 主导逻辑。
   - 状态：进行中。`paginationPolicy` 已抽出统一 reuse/split normalize 协议，`fragmentModel` 已接入 worker eligibility、list 子块委托与 renderer reuse 判定；容器/叶子职责、split chunk 物化、leaf overflow 判定、empty-visible split 判定都已开始走共享 helper，分页主循环暂未切到 fragment paginate。

6. 建立独立的 paint/display list 层。
   - 目标：把 canvas 绘制命令和布局结果解耦，为局部重绘、图层化、复杂装饰顺序提供稳定抽象。
   - 前提：先完成 box/fragment 主链收敛。

7. 清理 compatibility layer。
   - 目标：把 `layoutSemanticsLegacy`、`fragmentOwnerLegacy`、`legacySelectionGeometry`、`legacyVisualBounds` 限定为过渡层，并在新协议稳定后逐步移除。
   - 要求：不再往主链回流新的节点名特判。

当前剩余重点：

1. 渲染主链还不是纯递归。
   - 现状：`paragraph/heading/list` 这类仅依赖 `defaultRender` 的正文已经切到 `text-line fragment` 主路径，但 `codeBlock/table/image/video/horizontalRule` 等仍保留 `renderLine` 兼容层。
   - 剩余工作：继续缩小 `line body pass` 的职责，最终让 `renderLine` 只保留少量过渡兜底。

2. 文本交互还没有完全 fragment-first。
   - 现状：`coordsAtPos/posAtCoords/getHitAtCoords`、普通文本选区、文本装饰和 indexed 文本移动链已经优先走 `textBoxes`。
   - 剩余工作：继续把 caret/selection/drag 的纯文本路径迁到 `text-line` 叶子索引，并清掉多余的 line-first fallback。

3. 分页主循环仍然是过渡态。
   - 现状：`paginationPolicy`、`fragmentModel`、容器/叶子职责和 split chunk 物化已经抽出来了。
   - 剩余工作：把顶层 leaf overflow 决策继续从 `layoutPipeline` 状态编排中拆开，最后过渡到更统一的 container/fragment paginate。

4. display list 还没有独立抽象。
   - 现状：当前仍是布局结果直接驱动画布绘制。
   - 剩余工作：在 box/fragment 主链稳定后，再补独立的 paint/display list 层，用于局部重绘、图层化和绘制顺序管理。

5. compatibility layer 仍需最终清理。
   - 现状：legacy 逻辑已经被集中到独立模块，不再散落在主链。
   - 剩余工作：等新协议稳定后，逐步删掉这些兼容层，避免双路径长期并存。

建议执行顺序：

1. 先完成第 1 项，收口 `page` 级几何派生入口。
2. 再做第 2 项，把 box 前移到布局主链。
3. 然后做第 3、4 项，逐步把渲染和交互主链转成 fragment-first。
4. 最后处理第 5、6、7 项，把分页和兼容层一起收口。

## P1（产品化）

1. 粘贴/导入/导出保真。
2. 历史与协作冲突策略。
3. 只读/权限/评论态。
4. 链接与行内语义交互统一。
5. 移动端触控体验。

状态：已完成基础能力闭环，后续按业务形态补强。

## P2（规模化）

### P2.1 大文档性能优化（已完成）

已落地：

- 变更摘要驱动增量分页与块缓存失效控制。
- 页级复用与签名判等，减少无效重绘。
- 可见页虚拟化与 overlay 分层。
- 渐进式布局（先快后全）与异步调度。
- `perfBudgetSmoke` 预算冒烟入口。

验收入口：

- `?devTools=1&perfBudgetSmoke=1`
- 预算阈值以 `runPerfBudgetSmoke` 中配置为准（当前含 `maxElapsedMs=15000`、最小页数与最小文本量约束）。

### P2.2 无障碍与国际化（继续推进，当前优先）

当前进展（2026-02-23）：

- 已新增 `a11ySmoke`（ARIA 语义、焦点进出、状态播报、只读语义一致性）。
- 已新增 `i18nSmoke`（CJK 混排样例、行几何有效性、offset/pos 映射与坐标稳定性）。
- 已增强读屏播报：光标支持 page/line/column/node 信息，选区支持起止 page/line/column。
- 已在 playground 接入集中式本地化字典（`zh-CN` / `en-US`），并支持 `?locale=`/`?lang=` 参数切换。
- 已将顶部、菜单、工具栏与交互提示文案去散落化，统一由 `editor/i18n.ts` 管理。
- 已将换行分词器改为 locale-aware 可替换策略：主线程与 worker 分页均可按 `textLocale` 使用 `Intl.Segmenter`。
- 已补齐菜单栏与工具栏键盘导航（ArrowLeft/ArrowRight/Home/End），并在 `a11ySmoke` 增加自动回归断言。
- 已新增高对比模式开关：支持 `?contrast=high`，并在 `a11ySmoke` 增加对比度与状态断言。

里程碑 A（无障碍基线）：

1. 完整键盘可达性（工具栏、菜单、编辑区、表格操作）。
2. 屏幕阅读器可读的语义播报（页码、选区、节点类型）。
3. 焦点管理与高对比模式验证。

里程碑 B（国际化排版）：

1. CJK + 英文混排的行分割策略升级（接入可替换分词器）。
2. 本阶段不纳入 RTL，聚焦 CJK + 英文混排稳定性。
3. 本地化字符串集中管理（playground + dev-tools）。

验收标准：

- 新增 `a11ySmoke`、`i18nSmoke`。
- 关键路径无 keyboard trap，无读屏阻断。
- 复杂混排文档分页与选区行为稳定。

### P2.3 安全治理（已完成）

当前进展（2026-02-23）：

- 已新增 `securitySmoke`（粘贴清洗、URL 协议白名单、危险 payload 回归）。
- 已强化 `pastePolicy`：移除事件属性与 `style`，并对 `href/src` 启用协议白名单。
- 已下沉到解析层：`schema-basic` link mark、`node-image`、`node-video`、`markdown from_markdown` 均做协议过滤。
- 已抽取统一安全工具到 `packages/core/link`，策略从“多处重复实现”收敛为“单点维护”。
- 已将粘贴清洗核心能力下沉到 `packages/core/link`（`sanitizePastedHtml` / `normalizePastedText`），并支持可配置策略参数。
- 已新增 `sanitizeDocJson` 并接入 `CanvasEditorView.setJSON` 与 `createCanvasState`，JSON 导入路径纳入统一 URL 安全策略。
- 已将 Markdown 导入路径显式接入统一策略上下文（source=markdown），并与 HTML/JSON 共用同一 URL 策略面。
- 已新增安全审计事件流（drop/sanitize/source/target），playground 可按需开启并用于 `securitySmoke` 回归断言。
- `data:image` 已从宽松放行改为白名单（仅允许受控 MIME 且 base64），阻断 `svg` 等高风险载荷。

1. 将粘贴清洗策略从 playground 提升为可复用包（核心策略可配置）。（已完成）
2. URL 协议白名单与媒体源策略统一（链接、图片、视频同一治理面）。（已完成）
3. 导入路径（HTML/Markdown/JSON）建立统一 sanitize/validate 链路。（已完成）
4. 增加安全回归冒烟（XSS payload、恶意 URL、事件属性注入）。（已完成）

验收标准：

- 新增 `securitySmoke`。
- 危险 payload 全部被拒绝或清洗。
- 允许名单规则可配置且可审计。

### P2.4 插件生态规范（P2.3 后）

当前进展（2026-02-26）：

- 已抽取统一弹层生命周期运行时：`popup/popupLifecycle.ts`。
- `mention` 与 `selectionBubble` 已统一为 tiptap 风格渲染生命周期（`render + popupOptions`）。
- 已补齐规范文档：`docs/plugin-popup-lifecycle-guide.md`。
- 已补齐兼容矩阵草案：`docs/plugin-compat-matrix.md`。

1. 固化插件生命周期与优先级规则（props / plugin props / legacy fallback）。
2. 发布插件开发模板（node、command、selectionGeometry、decorations）。
3. 兼容矩阵与版本策略文档化（核心版本 vs 插件版本）。
4. 示例仓与最小插件集（至少：批注、目录、分页标尺）。

验收标准：

- 提供插件作者指南与模板仓库。
- 至少 3 个官方示例插件通过 allSmoke。

## 建议执行顺序（“优化完继续”）

1. 先执行包治理主线（`docs/package-governance-checklist.md` 的 P0/P1/P2）。
2. 包治理 P0 完成后，再继续 P2.2 里程碑 A（无障碍基线）。
3. 再做 P2.2 里程碑 B（国际化排版），补齐 CJK 与本地化字符串治理。
4. 在 P2.2 收口后，推进 P2.4 插件生态规范冻结与模板发布。

## 回归开关与联调方式

```txt
http://localhost:5173/?devTools=1&allSmoke=1
http://localhost:5173/?devTools=1&p0Smoke=1
http://localhost:5173/?devTools=1&perfBudgetSmoke=1
```

关键日志：

- `[all-smoke-summary] total=... pass=... fail=...`
- `[p0-smoke-summary] total=... pass=... fail=... missing=[...]`
- `[perf-budget-smoke] PASS|FAIL {...}`

### P2.5 输入与分页稳定性修复（2026-02-24，已完成）

当前进展（2026-02-24）：

- 已修复表格结构变更后 `table-smoke` 失败（增删行列后的 selection/导航同步）。
- 已修复拖拽媒体（图片/视频）占位符错位与垂直探针失败问题。
- 已修复拖拽指示线方向/位置异常（改为节点间横线并校正 Y 偏移）。
- 已修复 list 节点拖拽时 handle 丢失与 drop 后选中态异常。
- 已修复冷启动直接点击 handle 导致页面“消失”的点击链路冲突。
- 已修复 `security-smoke` 中 markdown 解析失败（依赖与解析链路恢复）。
- 已修复 dev-tools 引入导致的 `jotai/@compiled/react/lumenpage-dev-tools` 解析错误（playground 侧移除 dev-tools 依赖）。
- 已修复分页 worker `postMessage could not be cloned`（worker 入参改为可结构化克隆的纯数据）。
- 已修复连续 Enter 时分页/光标抖动（最新 selection 驱动 caretOffset，尾页边界场景禁用本次 progressive 截断）。
- 已修复最后一行末尾 Enter “往前跳一格”（caret 边界命中优先级修正，支持 start/end 边界偏好）。
- 已修复布局版本跳变时旧页缓存残留（版本跳跃强制 redraw）。

性能策略（当前）：

1. 默认保留增量分页与页复用。
2. 仅在尾页边界 Enter 场景触发一次强同步路径，避免光标视觉回跳。
3. 常规输入仍走增量路径，不扩大性能回退面。

关键实现位置：

- `apps/playground/src/editor/paginationDocWorkerClient.ts`
- `packages/engine/view-canvas/src/view/input/handlers.ts`
- `packages/engine/view-canvas/src/view/renderSync.ts`
- `packages/engine/view-canvas/src/view/caret.ts`
- `packages/engine/view-canvas/src/view/posIndex.ts`
- `packages/engine/view-canvas/src/view/renderer.ts`
- `packages/engine/view-canvas/src/core/editor/editorOps.ts`
