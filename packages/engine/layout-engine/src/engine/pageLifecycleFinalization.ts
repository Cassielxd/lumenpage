import {
  resolveFinalizePageReuseDecision,
  shouldStopAtProgressiveCutoff,
} from "./pageContinuation.js";
import { createPaginationSyncDiagnostics } from "./paginationDiagnostics.js";
import { newPage, populatePageDerivedState } from "./pageState.js";

export function finalizeCurrentPage(options: {
  session: any;
  perf: any;
  previousLayout: any;
  offsetDelta: number;
  appendGhostTrace: (ghostTrace: any[] | null, event: any) => void;
  ghostTrace: any[] | null;
  syncCurrentPageBoxes: () => any;
  maybeSync: () => boolean;
  setCurrentPage: (nextPage: any, seedLines?: any[] | null) => void;
  cascadePagination: boolean;
  cascadeFromPageIndex: number | null;
  cascadeStopPageIndex: number | null;
  marginTop: number;
}) {
  const {
    session,
    perf,
    previousLayout,
    offsetDelta,
    appendGhostTrace,
    ghostTrace,
    syncCurrentPageBoxes,
    maybeSync,
    setCurrentPage,
    cascadePagination,
    cascadeFromPageIndex,
    cascadeStopPageIndex,
    marginTop,
  } = options;

  if (session.page.lines.length > 0) {
    syncCurrentPageBoxes();
    populatePageDerivedState(session.page);
    session.pages.push(session.page);

    const finalizeReuseDecision = resolveFinalizePageReuseDecision({
      cascadePagination,
      cascadeFromPageIndex,
      pageIndex: session.pageIndex,
      page: session.page,
      previousLayout,
      offsetDelta,
      preferredBoundaryAnchor:
        session.syncAfterNewFragmentAnchor ?? session.syncAfterFragmentAnchor ?? null,
    });
    if (finalizeReuseDecision) {
      appendGhostTrace(ghostTrace, {
        ...finalizeReuseDecision.trace,
        syncDiagnostics: finalizeReuseDecision.diagnostics ?? null,
      });
      session.syncFromIndex = finalizeReuseDecision.syncFromIndex;
      session.syncMatchPass = finalizeReuseDecision.trace?.matchPass ?? finalizeReuseDecision.reason;
      session.syncDiagnostics = finalizeReuseDecision.diagnostics ?? null;
      session.progressiveApplied = true;
      session.shouldStop = true;
      if (perf) {
        perf.maybeSyncReason = finalizeReuseDecision.reason;
      }
      return true;
    }
  }
  if (maybeSync()) {
    return true;
  }
  if (
    shouldStopAtProgressiveCutoff({
      cascadePagination,
      previousLayout,
      cascadeStopPageIndex,
      pageIndex: session.pageIndex,
    })
  ) {
    session.syncFromIndex = session.pageIndex;
    session.syncMatchPass = "progressive-cutoff";
    session.syncDiagnostics = createPaginationSyncDiagnostics({
      source: "progressive-cutoff",
      reason: "progressive-cutoff",
      matchPass: "progressive-cutoff",
    });
    session.progressiveApplied = true;
    session.progressiveTruncated = true;
    session.shouldStop = true;
    if (perf) {
      perf.progressiveTruncated = true;
      perf.maybeSyncReason = "progressive-cutoff";
    }
    return true;
  }
  session.pageIndex += 1;
  setCurrentPage(newPage(session.pageIndex));
  session.cursorY = marginTop;
  return false;
}
