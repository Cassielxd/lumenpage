import { createPageBoxCollector } from "../pageBoxes";
import { newPage } from "./pageState";
import type { LayoutPaginationSession } from "./pageLifecycle";

export const createLayoutPipelineSession = ({
  marginTop,
}: {
  marginTop: number;
}): LayoutPaginationSession => ({
  pages: [],
  pageIndex: 0,
  page: newPage(0),
  pageBoxCollector: createPageBoxCollector(),
  cursorY: marginTop,
  textOffset: 0,
  startBlockIndex: 0,
  syncAfterIndex: null,
  canSync: false,
  passedChangedRange: false,
  shouldStop: false,
  syncFromIndex: null,
  progressiveApplied: false,
  progressiveTruncated: false,
  resumeFromAnchor: false,
  resumeAnchorApplied: false,
  resumeAnchorTargetY: null,
});
