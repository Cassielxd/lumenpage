# 未对齐/未实现清单（对标 ProseMirror）

## 核心输入与事件
- beforeinput/IME/drag/drop/selectionchange 的完整事件链对齐
- 拖拽、剪切、粘贴的细粒度输入类型覆盖（如 insertFromDrop、deleteByCut）
- 组合输入（composition）在多浏览器的一致性行为

## Schema 与结构能力
- list_item 允许 block+（已完成）
- table_cell 允许 block+（已完成）
- 深层嵌套结构（list → blockquote → table 等）：列表内嵌表格/引用已支持

## 表格能力（prosemirror-tables 对齐）
- 行/列插入与删除
- 单元格合并与拆分
- 表格选区（CellSelection）
- 表格导航与快捷键（Tab/Shift-Tab）
- 表格头部/属性与渲染一致性

## 视图与选区
- NodeSelection/GAP Cursor 细节对齐
- 多选区与跨块选区行为对齐
- scrollIntoView 行为细节与原版一致

## 插件生态与命令
- 完整 keymap 组合与命令覆盖
- InputRules 与 History 边界行为一致性
- NodeView/Decoration 等生态接口对齐

## 协作（collab）
- Steps mapping 与 rebase
- 本地/远端冲突处理与一致性
- Undo/redo 与协作的交互一致性

## 其他
- 更完整的 marks 行为（组合/嵌套/渲染一致性）
- 事件/渲染性能指标体系与对比基线
