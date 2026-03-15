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
} from "./segmenter";
export { measureTextWidth, getFontSize } from "./measure";
export { getPageX } from "./pageAlign";
export { getVisiblePages } from "./virtualization";
export { findLineForOffset, offsetAtX, getCaretRect, getCaretFromPoint } from "./caret";
export {
  findNearestLineOwnerWithCapability,
  getNearestContentOwner,
  hasLayoutCapability,
  hasLineLayoutCapability,
  isLineVisualBlock,
  isTableLayoutLine,
  type LayoutCapability,
} from "./layoutSemantics";
export { coordsAtPos, posAtCoords } from "./posIndex";
export {
  buildLayoutIndex,
  findLineForOffsetIndexed,
  getCaretFromPointIndexed,
  getFirstLineForBlockId,
  getBoxesInRange,
  getLineAtOffset,
  getLinesInRange,
  getTextBoxesInRange,
  getPageIndexForOffset,
  offsetAtXIndexed,
  posAtCoordsIndexed,
} from "./layoutIndex";
export type { LayoutIndex } from "./layoutIndex";
export { createSelectionMovement } from "./selectionMovement";
