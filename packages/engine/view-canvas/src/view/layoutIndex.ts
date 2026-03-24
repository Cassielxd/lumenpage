import {
  buildLayoutIndex as runtimeBuildLayoutIndex,
  findLineForOffsetIndexed,
  getCaretFromPointIndexed,
  getFirstLineForBlockId,
  getLineAtOffset,
  getLinesInRange,
  getTextBoxesInRange,
  getTextLineItemsInRange,
  getPageIndexForOffset,
  offsetAtXIndexed,
  posAtCoordsIndexed,
  type LayoutIndex,
} from "lumenpage-view-runtime";

export const buildLayoutIndex = (
  layout: any,
  previousIndex: any = null,
  previousLayout: any = null
): LayoutIndex | null =>
  runtimeBuildLayoutIndex(layout, previousIndex, previousLayout);

export {
  findLineForOffsetIndexed,
  getCaretFromPointIndexed,
  getFirstLineForBlockId,
  getLineAtOffset,
  getLinesInRange,
  getTextBoxesInRange,
  getTextLineItemsInRange,
  getPageIndexForOffset,
  offsetAtXIndexed,
  posAtCoordsIndexed,
};
