import { resolveMaybeSyncDecision } from "./pageSync";

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
  const maybeSyncDecision = resolveMaybeSyncDecision({
    candidateReuseEnabled,
    canSync: session.canSync,
    passedChangedRange: session.passedChangedRange,
    previousLayout,
    pageIndex: session.pageIndex,
    page: session.page,
    previousPageFirstBlockIdIndex,
    previousPageSignatureIndex,
    previousPageReuseIndex,
    syncAfterIndex: session.syncAfterIndex,
    pageReuseProbeRadius,
    pageReuseRootIndexProbeRadius,
    offsetDelta,
    createDiff: () => (perf ? {} : null),
  });
  if (!maybeSyncDecision.ok) {
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
      `[layout-engine] maybeSync FAILED precheck: reason=${maybeSyncDecision.reason}, canSync=${session.canSync}, passedChangedRange=${session.passedChangedRange}`
    );
    if (maybeSyncDecision.reason === "page-not-equivalent") {
      appendGhostTrace(ghostTrace, {
        event: "maybe-sync-miss",
        pageIndex: session.pageIndex,
        reason: "page-not-equivalent",
        candidateCount: maybeSyncDecision.candidateIndexes.length,
      });
      logLayout(
        `[layout-engine] maybeSync FAILED: page-not-equivalent, pageIndex=${session.pageIndex}, candidates checked`
      );
    }
    return false;
  }
  logLayout(
    `[layout-engine] maybeSync checking: canSync=${session.canSync}, passedChangedRange=${session.passedChangedRange}, pageIndex=${session.pageIndex}`
  );
  appendGhostTrace(ghostTrace, {
    event: "maybe-sync-candidates",
    pageIndex: session.pageIndex,
    candidateIndexes: maybeSyncDecision.candidateIndexes.slice(0, 20),
    candidateCount: maybeSyncDecision.candidateIndexes.length,
    signatureKey: maybeSyncDecision.signatureKey,
    syncAfterIndex: session.syncAfterIndex,
  });
  if (perf) {
    perf.maybeSyncReason = "reuse-ok";
  }
  appendGhostTrace(ghostTrace, {
    event: "maybe-sync-hit",
    pageIndex: session.pageIndex,
    matchedOldPageIndex: maybeSyncDecision.matchedOldPageIndex,
  });
  logLayout(
    `[layout-engine] maybeSync SUCCESS: matchedOldPageIndex=${maybeSyncDecision.matchedOldPageIndex}`
  );
  session.syncFromIndex = maybeSyncDecision.matchedOldPageIndex;
  session.shouldStop = true;
  session.progressiveApplied = true;
  return true;
}
