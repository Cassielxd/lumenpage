export { Renderer } from "./renderer.js";
export { CanvasRenderer } from "./render/canvasRenderer.js";
export { createRenderSync } from "./renderSync.js";
export { createSelectionMovement } from "./selectionMovement.js";
export { attachInputBridge } from "./input/bridge.js";
export { createInputHandlers } from "./input/handlers.js";
export { createClipboardHandlers } from "./input/clipboard.js";
export { createPointerHandlers } from "./input/pointerHandlers.js";
export { coordsAtPos, posAtCoords } from "./posIndex.js";
export { findLineForOffset, offsetAtX } from "./caret.js";
export { selectionToRects } from "./render/selection.js";
export { measureTextWidth, getFontSize } from "./measure.js";
export { createHtmlParser } from "./htmlParser.js";
export { CanvasEditorView } from "./editorView.js";
export { createSegmentText, createLinebreakSegmentText } from "./segmenter.js";
export { Decoration, DecorationSet, type CanvasDecoration, type DecorationSpec } from "./decorations.js";
export { type CanvasNodeView, type NodeViewFactory } from "./nodeView.js";
export { createCanvasConfigPlugin, canvasConfigKey, getCanvasConfig, type CanvasConfig } from "./canvasConfig.js";
export {
  clearLegacyCanvasConfigHits,
  getLegacyCanvasConfigHits,
} from "./editorView/legacyConfigWarnings.js";
export type {
  CanvasEditorViewProps,
  NodeSelectionTargetArgs,
} from "./editorView/types.js";
