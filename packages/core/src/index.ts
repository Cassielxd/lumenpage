/*
 * 文件说明：核心库导出入口。
 * 主要职责：统一导出编辑器状态、命令、布局与渲染相关 API。
 */

export { createEditorState, applyTransaction } from "./editor/state";

export {
  basicCommands,
  runCommand,
  setBlockAlign,
  setParagraphIndent,
  changeParagraphIndent,
  setHeadingLevel,
  setParagraph,
} from "./editor/commands";

export { LayoutPipeline } from "./layout/engine";

export { docToRuns, textToRuns, textblockToRuns } from "./layout/textRuns";

export { breakLines } from "./layout/lineBreaker";

export { NodeRendererRegistry } from "./layout/nodeRegistry";

export { textOffsetToDocPos, docPosToTextOffset } from "./editor/offsetMapping";
export {
  createSelectionStateAtOffset,
  getSelectionOffsets,
  getSelectionAnchorOffset,
  createSelectionLogger,
} from "./editor/selectionUtils";
export { createEditorOps } from "./editor/editorOps";
