# 会话接手入口（2026-02-25）

## 目的

下次继续开发时，先读本文件再进入其它文档。  
本文件不仅是状态摘要，也是“架构实现 + 功能扩展”决策入口。

## 必读顺序（5-10 分钟）

1. `docs/session-handoff.md`（本文件，先看全局与优先级）
2. `docs/editor-gap-roadmap.md`（路线图与阶段目标）
3. `docs/package-governance-checklist.md`（分层治理与门禁）
4. `docs/fix-log-2026-02-24.md`（近期关键修复链路）
5. `docs/lumen-menu-feature-checklist.md`（Lumen 菜单能力落地清单）

## 当前状态快照

- 包治理主线已完成：`core -> engine -> extensions -> apps` 已落地并有脚本门禁。
- 输入、拖拽、分页主稳定性问题已修复，见 `docs/fix-log-2026-02-24.md`。
- Lumen 产品壳（`apps/lumen`）已形成，当前重心是菜单与命令接线完善。
- 范围约束：
  - 暂不考虑移动端。
  - 暂不考虑 RTL。

## 本会话新增落地（2026-02-25）

1. 分包与接线治理

- 新增 `docs/lumen-feature-packaging-plan.md`，冻结了 Lumen 功能在 app 内的分域边界与下沉准入规则。
- 工具栏动作按域拆分到 `apps/lumen/src/editor/toolbarActions/*` 与 `handlers/*`，继续避免回流到单文件。

2. 菜单能力新增（已可执行）

- 会话模式：`viewer`（编辑/阅读切换 + 模式感知禁用策略）。
- 文本动作：`clear-format`、`search-replace`。
- 段落动作：`align-justify`、`align-distributed`。
- 导出动作：`export-word`（生成 Word 可打开的 HTML 文档壳并下载 `.doc`）。
- 页面外观：`page-line-number`、`page-watermark`、`page-background`。
- 插入能力：`hard-break`（硬换行）。
- 轻量插入：`symbol`、`emoji`、`chinese-date`。

3. 导出链路一致性（本轮延续）

- `export-html` 与打印预览统一走同一生成路径。
- `print` 先弹预览界面再触发浏览器打印。
- `export-pdf` 独立于浏览器整页打印，改为页面 canvas 合成 PDF。

4. 验证结果

- 通过：`pnpm.cmd -C apps/lumen typecheck`
- 通过：`pnpm.cmd -C packages/extensions/kit-basic typecheck`
- 通过：`pnpm.cmd governance:check`
- 说明：`pnpm.cmd typecheck`（workspace 全量）在当前环境偶发 `spawn EPERM`，非代码级类型错误。

## 架构深度分析（本次重点）

### 1. 分层治理已从“约定”变成“可执行约束”

- 治理源：`governance/package-catalog.json`
  - 定义每个包的层级与可见性（`public/internal/app-only`）。
  - 定义层级依赖白名单（例如 extensions 不能反向依赖 apps）。
- 门禁脚本：
  - `scripts/check-package-governance.mjs`：依赖方向/层级一致性。
  - `scripts/check-layout-engine-redirects.mjs`：`view-canvas/layout-pagination` 必须是 `layout-engine` 转发层。
  - `scripts/check-view-runtime-sync.mjs`：`view-canvas/view/*` 的 runtime 工具必须转发到 `view-runtime`。
  - `scripts/check-plugin-aggregation-imports.mjs`：应用侧禁止直连旧插件包，统一走 `lumenpage-editor-plugins`。

结论：当前架构可维护性明显提升，新增能力时有“边界守卫”，不再靠人工约束。

### 2. `CanvasEditorView` 已拆成组合式运行时（但仍是总装层）

核心实现文件：`packages/engine/view-canvas/src/view/editorView.ts`

当前构造流程是“装配器”模式，而不是单文件硬编码：

1. 环境初始化：`editorView/bootstrap.ts`
2. 命令运行时：`editorView/commandRuntime.ts`
3. 插件与 props 聚合：`editorView/plugins.ts`
4. 状态流转：`editorView/stateFlow.ts`
5. 输入管线：`editorView/inputPipeline.ts`
6. 交互管线：`editorView/interactions.ts`
7. 渲染同步：`view/renderSync.ts`
8. NodeView 管理：`editorView/nodeViews.ts`

结论：`EditorView` 仍是复杂中心，但职责已可拆解，后续继续抽离不会推倒重来。

### 3. 输入 -> 事务 -> 布局 -> 渲染 数据流已闭环

主链路：

1. DOM 输入桥接：`view/input/bridge.ts`
2. 输入处理：`view/input/handlers.ts`
3. 命令/事务派发：`editorView/stateFlow.ts`
4. 变更摘要生成：`core/editor/changeSummary.ts`
5. 布局执行：`engine/layout-engine/src/engine.ts`
6. 渲染与 overlay：`view/renderer.ts` + `view/renderSync.ts`
7. 命中映射闭环：`mapping/offsetMapping.ts` + `view-runtime/posIndex|caret|layoutIndex`

关键点：布局、渲染、NodeView overlay 分层明确，复杂节点不再要求 DOM 与 Canvas 二选一。

### 4. 分页引擎实现成熟，支持“复杂节点分页协议”

核心：`packages/engine/layout-engine/src/engine.ts`

- `layoutFromDoc` 支持 `previousLayout + changeSummary + progressiveMaxPages`。
- 块缓存以 `blockId + indent + signature` 复用，降低重复布局成本。
- 节点渲染协议支持：
  - `layoutBlock`（自定义块布局）
  - `splitBlock`（跨页切片）
  - `allowSplit`（拆分页策略）
- 表格已走复杂分页路径（`packages/extensions/node-table/src/index.ts`）：
  - 行级分页 + 行内切分。
  - 切片元信息继承（`sliceFromPrev/sliceHasNext/rowSplit`）。
  - 边框渲染连续性处理（避免跨页视觉断裂）。

结论：功能扩展时，复杂块（table/后续callout等）已有可复用分页协议，不需要再造一套。

### 5. 扩展接口设计清晰，核心有三条主通道

1. 节点扩展（推荐）

- NodeSpec：`schema-basic` 或 `node-*` 包。
- NodeRenderer：`toRuns/layoutBlock/splitBlock/renderLine/createNodeView`。
- 注册点：`kit-basic/src/index.ts` 的 `registerNodeRenderers`。

2. 编辑行为扩展

- `CanvasEditorViewProps` + plugin props（统一由 `editorView/plugins.ts` 聚合）。
- 读取顺序是 props 链，不再鼓励旧 `canvasConfig` 直连。

3. 命令扩展

- `kit-basic/src/commands.ts` 提供基础 command/runtime keymap。
- 应用层通过 `commandConfig` 注入，避免把产品逻辑下沉到 engine。

补充：`offsetMapping` 已下沉到节点 spec（table/list/media/hr/pageBreak 等），核心映射逻辑不再硬编码节点分支。

### 6. Worker 策略是“双轨 + 回退”，正确性优先

- 引擎侧 runs worker：`packages/engine/view-canvas/src/view/paginationWorkerClient.ts`
  - 仅对“简单文档”启用（检测到 `layoutBlock/splitBlock` 的复杂节点会回退主线程）。
- 应用侧 doc worker：`apps/playground/src/editor/paginationDocWorkerClient.ts`
  - 传 `docJson + seedLayout + changeSummary`，在 worker 内完整执行 `layoutFromDoc`。
- 两条路径都具备失败回退到主线程同步布局的兜底逻辑（`renderSync.ts`）。

结论：大文档性能与复杂节点正确性之间已经有可控折中，不是单一路径硬赌。

## 功能扩展现状（重点）

### 已具备的扩展能力

- 文档结构：段落、标题、引用、代码块、列表、表格、图片、视频、分页符等。
- 命令体系：文本样式、块样式、列表、表格核心操作、媒体插入、分页标记。
- 安全治理：HTML/Markdown/JSON 导入路径统一走 `lumenpage-link` 策略。
- smoke 回归：`allSmoke/p0Smoke/perfBudgetSmoke` 可用于功能回归基线。

### 当前扩展缺口（优先处理）

1. Lumen 菜单命令接线不完整

- `apps/lumen/src/editor/toolbarCatalog.ts` 中大量 `implemented=false`。
- `EditorToolbar.vue` 仅接了高频命令，长尾功能尚未落地。

2. 菜单信息架构处于收敛中

- `EditorMenuBar.vue` 隐藏了 `export` Tab。
- 但 `toolbarCatalog.ts` 仍保留 `export` 分组，当前策略是“开始区复用导出动作”。

3. 构建预算快照已补齐（2026-02-25）

- `governance/build-budget-snapshot.json` 已回填实测值：
  - `coldBuildMs=96573.1`
  - `incrementalBuildMs=84380.6`

4. 测试形态偏 smoke，缺 package 级单测体系

- 对复杂扩展（如新节点 splitBlock）回归粒度仍偏粗。

## 新增功能/节点标准流程（建议固定）

1. 先定落层

- 纯数据模型进 `core`；
- 布局/渲染机制进 `engine`；
- 业务节点和插件进 `extensions`；
- 交互编排进 `apps/*`。

2. 新节点最小实现闭环

- NodeSpec（含 `parseDOM/toDOM`）
- `offsetMapping`（保证 pos/offset/coords 稳定）
- NodeRenderer（至少 `layoutBlock + renderLine`，必要时 `splitBlock`）
- `kit-basic` 注册

3. 命令接线

- 先在 `kit-basic` 暴露 command；
- 再在 app 菜单编排层绑定 action。

4. 回归补齐

- 至少补一条对应 smoke（或扩展现有 smoke 断言）。

## 当前未提交代码（继续前先确认）

截至 2026-02-25，工作区存在以下未提交改动：

- `apps/lumen/src/components/EditorMenuBar.vue`
  - 顶部菜单页签过滤 `export`，UI 不显示“导出”Tab。
- `apps/lumen/src/editor/toolbarCatalog.ts`
  - 保留 `export` 分组（供“开始”区域复用导出动作）。
  - 补齐了部分表格命令项与分页标记项的实现标记。

说明：当前产品策略是“隐藏导出 Tab，但保留开始区导出能力”。

## 关键验证命令

- 本地开发：
  - `pnpm dev:lumen`
  - `pnpm dev`（playground）
- 类型检查：
  - `pnpm -C apps/lumen typecheck`
  - `pnpm -C apps/playground typecheck`
- 治理门禁：
  - `pnpm governance:check`

## Smoke 与联调入口

- `http://localhost:5173/?devTools=1&allSmoke=1`
- `http://localhost:5173/?devTools=1&p0Smoke=1`
- `http://localhost:5173/?devTools=1&perfBudgetSmoke=1`

重点观察日志：

- `[all-smoke-summary]`
- `[p0-smoke-summary]`
- `[perf-budget-smoke]`

## 已知注意事项

- `packages/tooling/dev-tools` 仍有独立依赖/类型问题，本轮不作为阻塞项。
- PowerShell 读取 UTF-8 文档可能乱码，需显式 UTF-8。
- worker 开启但回退主线程时，先看是否命中了复杂块回退条件（`layoutBlock/splitBlock`）。

## 下一步优先级（进入开发时按此执行）

1. 冻结 Lumen 菜单信息架构（顶部 Tab、开始区、下拉面板交互统一）。
2. 按 `docs/lumen-menu-feature-checklist.md` 清理“标记已实现但未接命令”的条目。
3. 推进 `P2.4` 插件生态规范（生命周期、模板、兼容矩阵、示例插件）。
4. 发布前补浏览器端 smoke gate（建议引入 Playwright 执行 `?allSmoke=1` 关键断言）。
5. 继续收敛 `apps/lumen` 菜单接线，优先清理 `implemented=false` 的高频项。
