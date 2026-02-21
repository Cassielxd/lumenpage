# 未对齐/未实现清单（对标 ProseMirror）

## 核心输入与事件
- beforeinput/IME/drag/drop/selectionchange 的完整事件链对齐
- 拖拽、剪切、粘贴的细粒度输入类型覆盖（如 insertFromDrop、deleteByCut）
- 组合输入（composition）在多浏览器的一致性行为
- `handleDOMEvents.selectionchange`（document 级监听）已对齐
- `beforeinput` 已补 `insertFromDrop` / `deleteByCut` 防重复处理
- composition 提交去重（`compositionend` + `insertFromComposition`）已补齐
- `selectionchange` 聚焦内同步（status/caret/render）已补齐

## Schema 与结构能力
- list_item 允许 block+（已完成）
- table_cell 允许 block+（已完成）
- 深层嵌套结构（list → blockquote → table 等）：列表内嵌表格/引用已支持

## 表格能力（prosemirror-tables 对齐）
- 行/列插入与删除（已完成）
- 单元格合并与拆分（已完成）
- 表格选区（CellSelection，已完成）
- 表格导航与快捷键（Tab/Shift-Tab，已完成）
- 表格头部/属性与渲染一致性（进行中）

## 视图与选区
- NodeSelection/GAP Cursor 细节对齐
- 多选区与跨块选区行为对齐
- scrollIntoView 行为细节与原版一致
- `EditorProps.attributes/editable` 读取顺序与插件扩展对齐（已完成）
- GapCursor 在只读态不再拦截 pointer 选区流程（已完成）
- `EditorView.hasFocus()` 对齐（已完成）
- `handleClickOn/handleDoubleClickOn` 节点链扩展点对齐（已完成）
- `handleTripleClick/handleTripleClickOn` 接口对齐（已完成）
- `handleScrollToSelection` 钩子对齐（已完成）
- `scrollThreshold` / `scrollMargin` 参数语义对齐（已完成）
- `active block` 高亮同类型串扰问题已修复（优先按 `blockId` 识别，同步保留旧兜底）
- NodeSelection 命中逻辑已从 `layout.blockId` 强依赖收敛为“文档位置优先，blockId 仅兜底”
- GapCursor 命中已补邻近位置探测（`pos±1/±2`），降低点击 gap 位置漏选概率

## 插件生态与命令
- 完整 keymap 组合与命令覆盖
- InputRules 与 History 边界行为一致性
- NodeView/Decoration 等生态接口对齐
- `EditorView.setProps` 动态更新 props（事件/属性/可编辑状态刷新）已完成
- `EditorView.someProp` 接口对齐（已完成）
- `EditorProps.dragCopies` 拖拽复制判定扩展点对齐（已完成）
- `handleDrop(view, event, slice, moved)` 参数语义对齐（已完成）
- `handlePaste(view, event, slice)` 参数语义对齐（已完成）
- `handleTextInput(view, from, to, text, deflt)` 参数语义对齐（已完成）
- `handleKeyDown` 补充 `Mod-Z/Mod-Shift-Z/Mod-Y` 撤销重做回退（已完成）
- `clipboardTextSerializer` / `clipboardTextParser` 扩展点对齐（已完成）
- `transformPastedText` / `transformPastedHTML` 扩展点对齐（已完成）
- `transformCopiedHTML` 扩展点对齐（已完成）
- `clipboardParser` / `clipboardSerializer` 扩展点对齐（已完成）
- dragstart 复用 `clipboardSerializer` / `clipboardTextSerializer`（已对齐）
- `handleDOMEvents.drop/drag*` 返回 true 后内建拖拽流程会跳过（已对齐）
- `handleDOMEvents` 在 `beforeinput/input/keydown/paste/copy/cut` 返回 true 后内建输入桥接流程会跳过（已对齐）
- `someProp(name, f)` 的回调返回值语义按 PM 对齐（仅 truthy 才中断查找，已对齐）
- `setProps` 后 `nodeViews` 工厂更新可立即生效（已对齐）
- `dragCopies` 默认修饰键语义按 PM 对齐（macOS: Alt，其他平台: Ctrl；仍可由 props 覆盖，已对齐）
- NodeSelection 默认判定改为“可选且非 textblock”，避免抢占文本光标；`nodeSelectionTypes` 仍可显式收窄（已对齐可用性）
- `commands.keymap` 运行时已接入：先 `handleKeyDown`，再 `keymap`，最后内置 fallback（默认不破坏现有行为）
- 内置键盘 fallback 可通过 `commands.fallbackKeyHandling=false` 关闭，支持更纯 PM keymap 驱动
- `commands.keymap` 键名兼容增强：`Arrow*`/`Left|Right|Up|Down`、`Escape|Esc`、`Delete|Del`、大小写/修饰键顺序无关
- `EditorProps.blockSelection` 已支持覆盖活动块高亮策略（`false` / `string[]` / `{enabled, types}`）

## 协作（collab）
- Steps mapping 与 rebase
- 本地/远端冲突处理与一致性
- Undo/redo 与协作的交互一致性

## 其他
- 更完整的 marks 行为（组合/嵌套/渲染一致性）
- 事件/渲染性能指标体系与对比基线
- 分页增量复用对“特殊结构”的判定从 table 硬编码抽象为可配置钩子（默认行为不变，已完成）
- `renderSync`、`hasFocus`、全局事件绑定/解绑已统一为 `ownerDocument/defaultView` 语义，降低多文档耦合
