/**
 * view-runtime split scaffold.
 *
 * This package is intentionally minimal at this stage.
 * Runtime modules from `lumenpage-view-canvas` will be migrated here incrementally.
 */
export type ViewRuntimeStage = "scaffold";

export const VIEW_RUNTIME_STAGE: ViewRuntimeStage = "scaffold";

export {
  createSegmentText,
  createLinebreakSegmentText,
  type SegmenterOptions,
} from "./segmenter.js";
export { measureTextWidth, getFontSize } from "./measure.js";
export { getPageX } from "./pageAlign.js";
export { getVisiblePages } from "./virtualization.js";
export { findLineForOffset, offsetAtX, getCaretRect, getCaretFromPoint } from "./caret.js";
export {
  findNearestLineOwnerWithCapability,
  getNearestContentOwner,
  hasLayoutCapability,
  hasLineLayoutCapability,
  isLineVisualBlock,
  isTableLayoutLine,
  type LayoutCapability,
} from "./layoutSemantics.js";
export { coordsAtPos, posAtCoords } from "./posIndex.js";
export {
  buildLayoutIndex,
  buildPartialLayoutIndex,
  findLineForOffsetIndexed,
  getCaretFromPointIndexed,
  getCaretRectIndexed,
  getFirstLineForBlockId,
  getAdjacentTextLineItem,
  getBoxesInRange,
  getLineAtOffset,
  getLinesInRange,
  getTextBoxesInRange,
  getTextLineItemAtOffset,
  getTextLineItemsInRange,
  getPageIndexForOffset,
  offsetAtXIndexed,
  posAtCoordsIndexed,
  mergeLayoutIndex,
  resolveStablePageEntryPrefixCount,
} from "./layoutIndex.js";
export type { LayoutIndex } from "./layoutIndex.js";
export { createSelectionMovement } from "./selectionMovement.js";
