# LumenPage 完整编辑器差距与补齐路线图

## 目标

把当前 Canvas 编辑器从“可用”提升到“稳定可交付”，优先保证交互一致性与回归可控。

## 当前阶段（2026-02）

- 已完成一批核心重构：`EditorView` 拆分、活动块选中插件化、拖拽句柄插件化、A4 画布样式落地。
- 当前重点转入“补齐行为 + 建立回归基线”。

## P0 清单（必须）

1. 输入法与选区稳定性
- 验收标准：
  - 中文 IME 输入时光标不丢失、不跳块。
  - 跨段落/跨节点选区后，继续输入与删除行为稳定。
  - NodeSelection 与 TextSelection 切换无闪烁、无错位。

2. 拖拽与选择一致性
- 验收标准：
  - 文本拖拽可移动，drop 位置准确。
  - 块拖拽（含图片/视频）可移动且不会触发错误选区跳转。
  - 拖拽句柄只在 hover 时显示，位置左对齐一致。

3. 表格行为补齐
- 验收标准：
  - Enter/Backspace/Delete 与预期一致，不出现异常合并。
  - 行列增删、合并拆分、范围选区可连续执行。
  - 工具栏状态与当前表格选区状态一致。

4. 列表行为补齐
- 验收标准：
  - Enter 创建下一项，空项 Enter 退出列表。
  - Backspace 在空项上回退层级，再次回退转段落。
  - 同一段落可在有序/无序列表之间正确切换。

5. 自动化回归基线
- 验收标准：
  - 至少包含表格、列表、块容器几何 3 类 smoke。
  - 每次改动可快速执行并产出 PASS/FAIL 明确结论。

## P1 清单（产品化）

1. 粘贴/导入/导出保真。
2. 历史与协作冲突策略。
3. 只读/权限/评论态。
4. 链接与行内语义交互统一。
5. 移动端触控体验。

## P2 清单（规模化）

1. 大文档压测与性能预算。
2. 无障碍与国际化。
3. 安全治理策略。
4. 插件生态规范与示例。

## 已开始的第一批完善

- 新增 Playground 回归开关：
  - `allSmoke=1`（一键执行全套）
  - `tableSmoke=1`
  - `tableBehaviorSmoke=1`
  - `listSmoke=1`
  - `listBehaviorSmoke=1`
  - `blockOutlineSmoke=1`
  - `dragSmoke=1`
  - `dragActionSmoke=1`
  - `selectionImeSmoke=1`
  - `imeActionSmoke=1`
  - `selectionBoundarySmoke=1`
  - `toolSmoke=1`
  - `pasteSmoke=1`
  - `historySmoke=1`
  - `mappingSmoke=1`
- 新增 `blockOutlineSmoke`，用于检查 `code_block` 和 `blockquote` 的块容器几何一致性，提前发现“选中框与可视块错位”问题。

## 使用方式

```txt
http://localhost:5173/?devTools=1&tableSmoke=1&tableBehaviorSmoke=1&listSmoke=1&listBehaviorSmoke=1&blockOutlineSmoke=1&dragSmoke=1&dragActionSmoke=1&selectionImeSmoke=1&imeActionSmoke=1&selectionBoundarySmoke=1&toolSmoke=1&pasteSmoke=1&historySmoke=1&mappingSmoke=1

或：

http://localhost:5173/?devTools=1&allSmoke=1
```

在调试面板或控制台查看：

- `[table-smoke] PASS|FAIL`
- `[table-behavior-smoke] PASS|FAIL`
- `[list-smoke] PASS|FAIL`
- `[list-behavior-smoke] PASS|FAIL`
- `[block-outline-smoke] PASS|FAIL`
- `[drag-smoke] PASS|FAIL`
- `[drag-action-smoke] PASS|FAIL`（文本与媒体节点拖拽）
- `[selection-ime-smoke] PASS|FAIL`
- `[ime-action-smoke] PASS|FAIL`
- `[selection-boundary-smoke] PASS|FAIL`
- `[tool-smoke] PASS|FAIL`
- `[paste-smoke] PASS|FAIL`
- `[history-smoke] PASS|FAIL`
- `[mapping-smoke] PASS|FAIL`
