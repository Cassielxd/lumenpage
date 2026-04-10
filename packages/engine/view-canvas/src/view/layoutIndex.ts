import {
  buildPartialLayoutIndex as runtimeBuildPartialLayoutIndex,
  buildLayoutIndex as runtimeBuildLayoutIndex,
  findLineForOffsetIndexed,
  getCaretFromPointIndexed,
  getFirstLineForBlockId,
  getLineAtOffset,
  getLinesInRange,
  getTextBoxesInRange,
  getTextLineItemsInRange,
  getPageIndexForOffset,
  mergeLayoutIndex as runtimeMergeLayoutIndex,
  offsetAtXIndexed,
  posAtCoordsIndexed,
  resolveStablePageEntryPrefixCount as runtimeResolveStablePageEntryPrefixCount,
  type LayoutIndex,
} from "lumenpage-view-runtime";

export const buildLayoutIndex = (
  layout: any,
  previousIndex: any = null,
  previousLayout: any = null
): LayoutIndex | null =>
  runtimeBuildLayoutIndex(layout, previousIndex, previousLayout);

export const buildPartialLayoutIndex = (
  layout: any,
  startPageIndex: number = 0,
  previousLayout: any = null,
  previousIndex: any = null
): LayoutIndex | null =>
  runtimeBuildPartialLayoutIndex(layout, startPageIndex, previousLayout, previousIndex);

export const mergeLayoutIndex = (
  existingIndex: LayoutIndex | null,
  newIndex: LayoutIndex | null,
  preservedPageCount: number = 0
): LayoutIndex | null => runtimeMergeLayoutIndex(existingIndex, newIndex, preservedPageCount);

export const resolveStablePageEntryPrefixCount = (
  layout: any,
  previousLayout: any,
  previousIndex: LayoutIndex | null
) => runtimeResolveStablePageEntryPrefixCount(layout, previousLayout, previousIndex);

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
