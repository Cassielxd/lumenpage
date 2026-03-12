export { Renderer } from "./renderer";
export { CanvasRenderer } from "./render/canvasRenderer";
export { createRenderSync } from "./renderSync";
export { createSelectionMovement } from "./selectionMovement";
export { attachInputBridge } from "./input/bridge";
export { createInputHandlers } from "./input/handlers";
export { createClipboardHandlers } from "./input/clipboard";
export { createPointerHandlers } from "./input/pointerHandlers";
export { coordsAtPos, posAtCoords } from "./posIndex";
export { findLineForOffset, offsetAtX } from "./caret";
export { selectionToRects } from "./render/selection";
export { measureTextWidth, getFontSize } from "./measure";
export { createHtmlParser } from "./htmlParser";
export { CanvasEditorView } from "./editorView";
export { createSegmentText, createLinebreakSegmentText } from "./segmenter";
export { Decoration, DecorationSet, type CanvasDecoration, type DecorationSpec } from "./decorations";
export { type CanvasNodeView, type NodeViewFactory } from "./nodeView";
export { createCanvasConfigPlugin, canvasConfigKey, getCanvasConfig, type CanvasConfig } from "./canvasConfig";
export {
  clearLegacyCanvasConfigHits,
  getLegacyCanvasConfigHits,
} from "./editorView/legacyConfigWarnings";
export type {
  CanvasCommands,
  CanvasEditorViewProps,
  NodeSelectionTargetArgs,
} from "./editorView/types";
