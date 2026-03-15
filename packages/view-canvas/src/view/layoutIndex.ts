import {
  buildLayoutIndex as runtimeBuildLayoutIndex,
  findLineForOffsetIndexed,
  getCaretFromPointIndexed,
  getFirstLineForBlockId,
  getLineAtOffset,
  getLinesInRange,
  getTextBoxesInRange,
  getPageIndexForOffset,
  offsetAtXIndexed,
  posAtCoordsIndexed,
  type LayoutIndex,
} from "lumenpage-view-runtime";
import { materializeLayoutGeometry } from "lumenpage-layout-engine";

const ensureLayoutPageGeometry = (layout: any) => materializeLayoutGeometry(layout);

export const buildLayoutIndex = (
  layout: any,
  previousIndex: any = null,
  previousLayout: any = null
): LayoutIndex | null =>
  runtimeBuildLayoutIndex(ensureLayoutPageGeometry(layout), previousIndex, previousLayout);

export {
  findLineForOffsetIndexed,
  getCaretFromPointIndexed,
  getFirstLineForBlockId,
  getLineAtOffset,
  getLinesInRange,
  getTextBoxesInRange,
  getPageIndexForOffset,
  offsetAtXIndexed,
  posAtCoordsIndexed,
};
