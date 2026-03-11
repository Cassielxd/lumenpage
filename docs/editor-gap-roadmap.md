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
- `packages/view-canvas`：Canvas 视图实现，负责输入、布局、渲染、命中、坐标映射。
- `packages/starter-kit` + `packages/extension-*`：默认 schema、命令、节点/mark/交互扩展注册。
- `packages/extension-*`：节点级与交互级扩展（paragraph、heading、list、table、image、video 等）。
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
- 已抽取统一安全工具到 `packages/link`，策略从“多处重复实现”收敛为“单点维护”。
- 已将粘贴清洗核心能力下沉到 `packages/link`（`sanitizePastedHtml` / `normalizePastedText`），并支持可配置策略参数。
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
- `packages/view-canvas/src/view/input/handlers.ts`
- `packages/view-canvas/src/view/renderSync.ts`
- `packages/view-canvas/src/view/caret.ts`
- `packages/view-canvas/src/view/posIndex.ts`
- `packages/view-canvas/src/view/renderer.ts`
- `packages/view-canvas/src/core/editor/editorOps.ts`
