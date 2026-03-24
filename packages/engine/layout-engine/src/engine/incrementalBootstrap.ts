import { resolveLayoutOffsetDelta, resolvePreviousPageReuseState } from "./incrementalState";
import { resolveResumeAnchorPlan } from "./resumeAnchor";
import { markReusedPages, newPage } from "./pageState";
import type { LayoutPaginationSession } from "./pageLifecycle";

export const resolveIncrementalBootstrapState = ({
  previousLayout,
  changeSummary,
  doc,
  docPosToTextOffset,
  enabled,
  pageHeight,
  pageWidth,
  pageGap,
  lineHeight,
  margin,
}: {
  previousLayout: any;
  changeSummary: any;
  doc: any;
  docPosToTextOffset: ((doc: any, pos: number) => number) | null;
  enabled: boolean;
  pageHeight: number;
  pageWidth: number;
  pageGap: number;
  lineHeight: number;
  margin: { left: number; right: number; top: number; bottom: number };
}) => ({
  ...resolvePreviousPageReuseState(previousLayout),
  offsetDelta: resolveLayoutOffsetDelta(changeSummary),
  resumeAnchorPlan: resolveResumeAnchorPlan({
    enabled,
    previousLayout,
    changeSummary,
    doc,
    docPosToTextOffset,
    pageHeight,
    pageWidth,
    pageGap,
    lineHeight,
    margin,
  }),
});

export const applyIncrementalBootstrap = ({
  bootstrap,
  previousLayout,
  session,
  setCurrentPage,
  appendGhostTrace,
  ghostTrace,
  logLayout,
}: {
  bootstrap: ReturnType<typeof resolveIncrementalBootstrapState>;
  previousLayout: any;
  session: LayoutPaginationSession;
  setCurrentPage: (nextPage: any, seedLines?: any[] | null) => void;
  appendGhostTrace: (ghostTrace: any[] | null, event: any) => void;
  ghostTrace: any[] | null;
  logLayout: (...args: any[]) => void;
}) => {
  let resumeAnchorPageIndex = null;
  let resumeAnchorLineIndex = null;
  let resumeAnchorMatchKey = null;
  let resumeAnchorSkippedReason = null;
  let reusedPrefixPages = 0;
  let reusedPrefixLines = 0;

  const resumeAnchorPlan = bootstrap.resumeAnchorPlan;
  if (!resumeAnchorPlan) {
    return {
      resumeAnchorPageIndex,
      resumeAnchorLineIndex,
      resumeAnchorMatchKey,
      resumeAnchorSkippedReason,
      reusedPrefixPages,
      reusedPrefixLines,
    };
  }

  if (previousLayout?.pages?.length) {
    logLayout(`[layout-engine] incremental mode, prevPages:${previousLayout.pages.length}`);
  }

  if (!resumeAnchorPlan.anchorFound) {
    return {
      resumeAnchorPageIndex,
      resumeAnchorLineIndex,
      resumeAnchorMatchKey,
      resumeAnchorSkippedReason,
      reusedPrefixPages,
      reusedPrefixLines,
    };
  }

  resumeAnchorPageIndex = resumeAnchorPlan.anchorPageIndex;
  resumeAnchorLineIndex = resumeAnchorPlan.anchorLineIndex;
  resumeAnchorMatchKey = resumeAnchorPlan.anchorMatchKey;
  appendGhostTrace(ghostTrace, {
    event: "resume-anchor-found",
    pageIndex: resumeAnchorPlan.anchorPageIndex,
    lineIndex: resumeAnchorPlan.anchorLineIndex,
    startIndexOld: resumeAnchorPlan.startIndexOld,
    startIndexNew: resumeAnchorPlan.startIndexNew,
    startOffset:
      Number.isFinite(resumeAnchorPlan.startOffset) ? Number(resumeAnchorPlan.startOffset) : null,
    blockId: resumeAnchorPlan.blockId ?? null,
    matchKey: resumeAnchorPlan.anchorMatchKey,
    blockIdMatches: resumeAnchorPlan.blockIdMatches === true,
    blockStartMatches: resumeAnchorPlan.blockStartMatches === true,
    rootIndexMatches: resumeAnchorPlan.rootIndexMatches === true,
    canResumeAnchor: resumeAnchorPlan.canResumeAnchor === true,
  });
  logLayout(
    `[layout-engine] anchor FOUND: pageIndex=${resumeAnchorPlan.anchorPageIndex}, lineIndex=${resumeAnchorPlan.anchorLineIndex}, match=${resumeAnchorPlan.anchorMatchKey}`
  );

  if (!resumeAnchorPlan.canResumeAnchor) {
    resumeAnchorSkippedReason = resumeAnchorPlan.skippedReason;
    appendGhostTrace(ghostTrace, {
      event: "resume-anchor-skipped",
      reason: resumeAnchorSkippedReason,
      pageIndex: resumeAnchorPlan.anchorPageIndex,
      lineIndex: resumeAnchorPlan.anchorLineIndex,
      matchKey: resumeAnchorPlan.anchorMatchKey,
    });
    return {
      resumeAnchorPageIndex,
      resumeAnchorLineIndex,
      resumeAnchorMatchKey,
      resumeAnchorSkippedReason,
      reusedPrefixPages,
      reusedPrefixLines,
    };
  }

  reusedPrefixPages = resumeAnchorPlan.reusedPrefixPages;
  reusedPrefixLines = resumeAnchorPlan.reusedPrefixLines;
  session.pages = markReusedPages(previousLayout.pages.slice(0, resumeAnchorPlan.reusedPrefixPages));
  session.pageIndex = resumeAnchorPlan.pageIndex;
  setCurrentPage(newPage(session.pageIndex), resumeAnchorPlan.reusedLines);
  session.cursorY = resumeAnchorPlan.anchorTargetY.y;
  session.resumeAnchorTargetY = resumeAnchorPlan.anchorTargetY;
  session.textOffset = resumeAnchorPlan.textOffset;
  session.startBlockIndex = resumeAnchorPlan.startBlockIndex;
  session.syncAfterIndex = resumeAnchorPlan.syncAfterIndex;
  session.syncAfterTextOffset = resumeAnchorPlan.syncAfterTextOffset ?? null;
  session.syncAfterOldTextOffset = resumeAnchorPlan.syncAfterOldTextOffset ?? null;
  session.syncAfterFragmentAnchor = resumeAnchorPlan.syncAfterFragmentAnchor ?? null;
  session.syncAfterFragmentPageIndex = resumeAnchorPlan.syncAfterFragmentPageIndex ?? null;
  logLayout(
    `[layout-engine] syncAfterIndex=${session.syncAfterIndex}, syncAfterTextOffset=${session.syncAfterTextOffset}, syncAfterOldTextOffset=${session.syncAfterOldTextOffset}, startBlockIndex=${session.startBlockIndex}`
  );
  session.canSync = resumeAnchorPlan.canSync;
  session.passedChangedRange = resumeAnchorPlan.passedChangedRange;
  session.passedChangedFragmentAnchor = resumeAnchorPlan.passedChangedFragmentAnchor === true;
  session.passedChangedFragmentBoundary = resumeAnchorPlan.passedChangedFragmentBoundary === true;
  logLayout(
    `[layout-engine] canSync=${session.canSync}, passedChangedRange=${session.passedChangedRange}, passedChangedFragmentAnchor=${session.passedChangedFragmentAnchor}, passedChangedFragmentBoundary=${session.passedChangedFragmentBoundary}`
  );
  session.resumeFromAnchor = true;
  session.resumeAnchorApplied = false;

  return {
    resumeAnchorPageIndex,
    resumeAnchorLineIndex,
    resumeAnchorMatchKey,
    resumeAnchorSkippedReason,
    reusedPrefixPages,
    reusedPrefixLines,
  };
};
