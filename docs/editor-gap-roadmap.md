# LumenPage 编辑器差距路线图（已修复乱码）

## 目标

把当前 Canvas 编辑器从“可用”推进到“稳定可交付、可规模化演进”。
优先级始终是：交互一致性 > 回归可控性 > 性能可预测性 > 扩展生态。

## 当前阶段（截至 2026-02-23）

- 已完成一轮核心重构：`EditorView` 模块化拆分、NodeView 管理、拖拽句柄插件化、A4 分页样式落地。
- 已建立 Smoke 回归体系：P0 套件、`allSmoke` 汇总、`perfBudgetSmoke` 性能预算冒烟。
- P2 的“大文档性能优化”已完成代码层落地，路线图进入下一段：无障碍/国际化、安全治理、插件生态规范化。

## 架构深度分析（现状）

### 1. 分层与模块边界

- `packages/model` / `packages/state` / `packages/transform` / `packages/commands`：ProseMirror 思想的 headless 核心能力。
- `packages/view-canvas`：Canvas 视图实现，负责输入、布局、渲染、命中、坐标映射。
- `packages/schema-basic` + `packages/kit-basic`：默认 schema、命令、节点渲染注册。
- `packages/node-*`：节点级扩展（paragraph、heading、list、table、image、video 等）。
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

### 4. 已识别风险（需纳入后续迭代）

- 文档编码历史问题仍存在（本文件已修复，`docs/pagination-layout.md` 仍有乱码）。
- `README.md` 引用了不存在的 `docs/prosemirror-gap.md`，文档索引存在漂移。
- `packages/model/src/tmpclaude-*` 临时文件应清理，避免误打包或误识别为源码。
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
- 已新增 `i18nSmoke`（CJK/RTL 混排样例、行几何有效性、offset/pos 映射与坐标稳定性）。
- 已增强读屏播报：光标支持 page/line/column/node 信息，选区支持起止 page/line/column。

里程碑 A（无障碍基线）：

1. 完整键盘可达性（工具栏、菜单、编辑区、表格操作）。
2. 屏幕阅读器可读的语义播报（页码、选区、节点类型）。
3. 焦点管理与高对比模式验证。

里程碑 B（国际化排版）：

1. CJK + 英文混排的行分割策略升级（接入可替换分词器）。
2. RTL 基础能力（方向、光标移动、选区绘制）补齐。
3. 本地化字符串集中管理（playground + dev-tools）。

验收标准：

- 新增 `a11ySmoke`、`i18nSmoke`。
- 关键路径无 keyboard trap，无读屏阻断。
- 复杂混排文档分页与选区行为稳定。

### P2.3 安全治理（P2.2 后并行启动）

当前进展（2026-02-23）：

- 已新增 `securitySmoke`（粘贴清洗、URL 协议白名单、危险 payload 回归）。
- 已强化 `pastePolicy`：移除事件属性与 `style`，并对 `href/src` 启用协议白名单。
- 已下沉到解析层：`schema-basic` link mark、`node-image`、`node-video`、`markdown from_markdown` 均做协议过滤。
- 已抽取统一安全工具到 `packages/link`，策略从“多处重复实现”收敛为“单点维护”。
- 已将粘贴清洗核心能力下沉到 `packages/link`（`sanitizePastedHtml` / `normalizePastedText`），并支持可配置策略参数。
- 已新增 `sanitizeDocJson` 并接入 `CanvasEditorView.setJSON` 与 `createCanvasState`，JSON 导入路径纳入统一 URL 安全策略。
- `data:image` 已从宽松放行改为白名单（仅允许受控 MIME 且 base64），阻断 `svg` 等高风险载荷。

1. 将粘贴清洗策略从 playground 提升为可复用包（核心策略可配置）。（已完成）
2. URL 协议白名单与媒体源策略统一（链接、图片、视频同一治理面）。
3. 导入路径（HTML/Markdown/JSON）建立统一 sanitize/validate 链路。（进行中：JSON 已接入）
4. 增加安全回归冒烟（XSS payload、恶意 URL、事件属性注入）。

验收标准：

- 新增 `securitySmoke`。
- 危险 payload 全部被拒绝或清洗。
- 允许名单规则可配置且可审计。

### P2.4 插件生态规范（P2.3 后）

1. 固化插件生命周期与优先级规则（props / plugin props / legacy fallback）。
2. 发布插件开发模板（node、command、selectionGeometry、decorations）。
3. 兼容矩阵与版本策略文档化（核心版本 vs 插件版本）。
4. 示例仓与最小插件集（至少：批注、目录、分页标尺）。

验收标准：

- 提供插件作者指南与模板仓库。
- 至少 3 个官方示例插件通过 allSmoke。

## 建议执行顺序（“优化完继续”）

1. 先做 P2.2 里程碑 A（无障碍基线），避免后续功能返工。
2. 并行预研 P2.3 安全治理的数据面与策略面抽象。
3. P2.2 里程碑 B 与 P2.3 联动完成后，再冻结 P2.4 插件规范。

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
