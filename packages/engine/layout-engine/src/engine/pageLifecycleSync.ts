import { resolveMaybeSyncDecision } from "./pageSync.js";
import { updateFragmentBoundaryProgress } from "./changeBoundary.js";
import {
  findFirstPageFragmentAnchorAfterTextOffset,
  pageHasFragmentAnchor,
} from "./fragmentContinuation.js";

export function maybeSyncCurrentPage(options: {
  session: any;
  perf: any;
  previousLayout: any;
  previousPageReuseIndex: any;
  previousPageFirstBlockIdIndex: Map<string, number[]> | null;
  previousPageSignatureIndex: Map<string, number[]> | null;
  offsetDelta: number;
  appendGhostTrace: (ghostTrace: any[] | null, event: any) => void;
  ghostTrace: any[] | null;
  logLayout: (...args: any[]) => void;
  candidateReuseEnabled: boolean;
  pageReuseProbeRadius: number | null | undefined;
  pageReuseRootIndexProbeRadius: number | null | undefined;
}) {
  const {
    session,
    perf,
    previousLayout,
    previousPageReuseIndex,
    previousPageFirstBlockIdIndex,
    previousPageSignatureIndex,
    offsetDelta,
    appendGhostTrace,
    ghostTrace,
    logLayout,
    candidateReuseEnabled,
    pageReuseProbeRadius,
    pageReuseRootIndexProbeRadius,
  } = options;

  if (perf) {
    perf.maybeSyncCalled = true;
  }
  if (
    !session.passedChangedFragmentAnchor &&
    typeof session.syncAfterFragmentAnchor === "string" &&
    pageHasFragmentAnchor(session.page, session.syncAfterFragmentAnchor)
  ) {
    session.passedChangedFragmentAnchor = true;
  }
  if (
    !session.syncAfterNewFragmentAnchor &&
    Number.isFinite(session.syncAfterTextOffset)
  ) {
    const newBoundaryAnchorRef = findFirstPageFragmentAnchorAfterTextOffset(
      session.page,
      session.syncAfterTextOffset
    );
    if (newBoundaryAnchorRef?.anchor) {
      session.syncAfterNewFragmentAnchor = newBoundaryAnchorRef.anchor;
    }
  }
  updateFragmentBoundaryProgress(session);
  const maybeSyncDecision = resolveMaybeSyncDecision({
    candidateReuseEnabled,
    canSync: session.canSync,
    passedChangedRange: session.passedChangedRange,
    passedChangedFragmentAnchor: session.passedChangedFragmentAnchor,
    passedChangedFragmentBoundary: session.passedChangedFragmentBoundary,
    previousLayout,
    pageIndex: session.pageIndex,
    page: session.page,
    previousPageFirstBlockIdIndex,
    previousPageSignatureIndex,
    previousPageReuseIndex,
    syncAfterIndex: session.syncAfterIndex,
    syncAfterOldTextOffset: session.syncAfterOldTextOffset,
    syncAfterFragmentAnchor: session.syncAfterFragmentAnchor,
    syncAfterNewFragmentAnchor: session.syncAfterNewFragmentAnchor,
    pageReuseProbeRadius,
    pageReuseRootIndexProbeRadius,
    offsetDelta,
    createDiff: () => (perf ? {} : null),
  });
  if (!maybeSyncDecision.ok) {
    session.syncDiagnostics = maybeSyncDecision.syncDiagnostics ?? null;
    if (maybeSyncDecision.reason === "candidate-reuse-disabled" && maybeSyncDecision.trace) {
      appendGhostTrace(ghostTrace, maybeSyncDecision.trace);
    }
    if (perf) {
      perf.maybeSyncReason = maybeSyncDecision.reason;
      if (maybeSyncDecision.reason === "precheck-failed") {
        perf.maybeSyncFailSnapshot = maybeSyncDecision.perfSnapshot;
      }
    }
    logLayout(
      `[layout-engine] maybeSync FAILED precheck: reason=${maybeSyncDecision.reason}, canSync=${session.canSync}, passedChangedRange=${session.passedChangedRange}, passedChangedFragmentAnchor=${session.passedChangedFragmentAnchor}, passedChangedFragmentBoundary=${session.passedChangedFragmentBoundary}`
    );
    if (maybeSyncDecision.reason === "page-not-equivalent") {
      appendGhostTrace(ghostTrace, {
        event: "maybe-sync-miss",
        pageIndex: session.pageIndex,
        reason: "page-not-equivalent",
        candidateCount:
          maybeSyncDecision.candidateIndexes.length +
          (maybeSyncDecision.textRangeFallbackCandidateIndexes?.length ?? 0) +
          (maybeSyncDecision.blockIdFallbackCandidateIndexes?.length ?? 0) +
          (maybeSyncDecision.rootRangeFallbackCandidateIndexes?.length ?? 0) +
          (maybeSyncDecision.signatureFallbackCandidateIndexes?.length ?? 0),
        syncDiagnostics: maybeSyncDecision.syncDiagnostics ?? null,
      });
      logLayout(
        `[layout-engine] maybeSync FAILED: page-not-equivalent, pageIndex=${session.pageIndex}, candidates checked`
      );
    }
    return false;
  }
  logLayout(
    `[layout-engine] maybeSync checking: canSync=${session.canSync}, passedChangedRange=${session.passedChangedRange}, passedChangedFragmentAnchor=${session.passedChangedFragmentAnchor}, passedChangedFragmentBoundary=${session.passedChangedFragmentBoundary}, pageIndex=${session.pageIndex}`
  );
  appendGhostTrace(ghostTrace, {
    event: "maybe-sync-candidates",
    pageIndex: session.pageIndex,
    candidateIndexes: maybeSyncDecision.candidateIndexes.slice(0, 20),
    candidateCount: maybeSyncDecision.candidateIndexes.length,
    textRangeFallbackCandidateIndexes: (
      maybeSyncDecision.textRangeFallbackCandidateIndexes || []
    ).slice(0, 20),
    textRangeFallbackCandidateCount:
      maybeSyncDecision.textRangeFallbackCandidateIndexes?.length ?? 0,
    blockIdFallbackCandidateIndexes: (
      maybeSyncDecision.blockIdFallbackCandidateIndexes || []
    ).slice(0, 20),
    blockIdFallbackCandidateCount:
      maybeSyncDecision.blockIdFallbackCandidateIndexes?.length ?? 0,
    rootRangeFallbackCandidateIndexes: (
      maybeSyncDecision.rootRangeFallbackCandidateIndexes || []
    ).slice(0, 20),
    rootRangeFallbackCandidateCount:
      maybeSyncDecision.rootRangeFallbackCandidateIndexes?.length ?? 0,
    signatureFallbackCandidateIndexes: (
      maybeSyncDecision.signatureFallbackCandidateIndexes || []
    ).slice(0, 20),
    signatureFallbackCandidateCount: maybeSyncDecision.signatureFallbackCandidateIndexes?.length ?? 0,
    fragmentSignatureKey: maybeSyncDecision.fragmentSignatureKey,
    signatureKey: maybeSyncDecision.signatureKey,
    syncAfterIndex: session.syncAfterIndex,
    syncAfterOldTextOffset: session.syncAfterOldTextOffset,
    syncAfterFragmentAnchor: session.syncAfterFragmentAnchor,
    syncAfterNewFragmentAnchor: session.syncAfterNewFragmentAnchor,
    syncDiagnostics: maybeSyncDecision.syncDiagnostics ?? null,
  });
  if (perf) {
    perf.maybeSyncReason = "reuse-ok";
  }
  appendGhostTrace(ghostTrace, {
    event: "maybe-sync-hit",
    pageIndex: session.pageIndex,
    matchedOldPageIndex: maybeSyncDecision.matchedOldPageIndex,
    matchPass: maybeSyncDecision.matchPass ?? null,
    equivalenceStage: maybeSyncDecision.equivalenceStage ?? null,
    syncDiagnostics: maybeSyncDecision.syncDiagnostics ?? null,
  });
  logLayout(
    `[layout-engine] maybeSync SUCCESS: matchedOldPageIndex=${maybeSyncDecision.matchedOldPageIndex}, matchPass=${maybeSyncDecision.matchPass ?? "unknown"}, equivalenceStage=${maybeSyncDecision.equivalenceStage ?? "unknown"}`
  );
  session.syncFromIndex = maybeSyncDecision.matchedOldPageIndex;
  session.syncMatchPass = maybeSyncDecision.matchPass ?? null;
  session.syncDiagnostics = maybeSyncDecision.syncDiagnostics ?? null;
  session.shouldStop = true;
  session.progressiveApplied = true;
  return true;
}
