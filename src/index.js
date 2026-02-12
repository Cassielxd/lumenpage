/*
 * 文件说明：核心库导出入口。
 * 主要职责：统一导出编辑器状态、命令、布局与渲染相关 API。
 */

export { schema, createDocFromText, docToText, serializeTableToText, getTableTextLength } from "./editor/schema.js";
export { createEditorState, applyTransaction } from "./editor/state.js";
export {
  basicCommands,
  runCommand,
  setBlockAlign,
  setParagraphIndent,
  changeParagraphIndent,
  setHeadingLevel,
  setParagraph,
} from "./editor/commands.js";
export { attachInputBridge } from "./input/bridge.js";
export { LayoutPipeline } from "./layout/engine.js";
export { docToRuns, textToRuns, textblockToRuns } from "./layout/textRuns.js";
export { breakLines } from "./layout/lineBreaker.js";
export { coordsAtPos, posAtCoords } from "./layout/posIndex.js";
export {
  NodeRendererRegistry,
  paragraphRenderer,
  headingRenderer,
  tableRenderer,
  createDefaultNodeRendererRegistry,
} from "./layout/nodeRegistry.js";
export { CanvasRenderer } from "./render/canvasRenderer.js";
export { selectionToRects } from "./render/selection.js";
