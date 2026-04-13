import { collectPageReuseCandidates, findEquivalentPageIndex } from "./pageSyncCandidates.js";
import { createPaginationSyncDiagnostics } from "./paginationDiagnostics.js";
import { resolveMaybeSyncPrecheck } from "./pageSyncPrecheck.js";

export * from "./pageSyncCandidates.js";
export * from "./pageSyncPrecheck.js";

/**
 * 统一解析当前页是否可以与旧布局中的某一页对齐。
 */
export function resolveMaybeSyncDecision(options: {
  candidateReuseEnabled: boolean;
  canSync: boolean;
  passedChangedRange: boolean;
  passedChangedFragmentAnchor: boolean;
  passedChangedFragmentBoundary: boolean;
  previousLayout: any;
  pageIndex: number;
  page: any;
  previousPageFirstBlockIdIndex: Map<string, number[]> | null;
  previousPageSignatureIndex: Map<string, number[]> | null;
  previousPageReuseIndex: any;
  syncAfterIndex: number | null;
  syncAfterOldTextOffset: number | null;
  syncAfterFragmentAnchor: string | null;
  syncAfterNewFragmentAnchor: string | null;
  pageReuseProbeRadius: number | null | undefined;
  pageReuseRootIndexProbeRadius: number | null | undefined;
  offsetDelta: number;
  createDiff: () => any;
}) {
  const precheck = resolveMaybeSyncPrecheck({
    candidateReuseEnabled: options.candidateReuseEnabled,
    canSync: options.canSync,
    passedChangedRange: options.passedChangedRange,
    passedChangedFragmentAnchor: options.passedChangedFragmentAnchor,
    passedChangedFragmentBoundary: options.passedChangedFragmentBoundary,
    syncAfterFragmentAnchor: options.syncAfterFragmentAnchor,
    syncAfterNewFragmentAnchor: options.syncAfterNewFragmentAnchor,
    previousLayout: options.previousLayout,
    pageIndex: options.pageIndex,
  });
  if (!precheck.ok) {
    return {
      ok: false as const,
      reason: precheck.reason,
      trace: "trace" in precheck ? precheck.trace : null,
      perfSnapshot: "perfSnapshot" in precheck ? precheck.perfSnapshot : null,
      syncDiagnostics: createPaginationSyncDiagnostics({
        source: "maybe-sync",
        reason: precheck.reason,
        boundaryAnchor: options.syncAfterFragmentAnchor,
        expectedBoundaryAnchor: options.syncAfterNewFragmentAnchor,
      }),
    };
  }

  const {
    candidateIndexes,
    textRangeFallbackCandidateIndexes,
    blockIdFallbackCandidateIndexes,
    rootRangeFallbackCandidateIndexes,
    signatureFallbackCandidateIndexes,
    signatureKey,
    fragmentSignatureKey,
  } = collectPageReuseCandidates({
    pageIndex: options.pageIndex,
    page: options.page,
    previousLayout: options.previousLayout,
    previousPageFirstBlockIdIndex: options.previousPageFirstBlockIdIndex,
    previousPageSignatureIndex: options.previousPageSignatureIndex,
    previousPageReuseIndex: options.previousPageReuseIndex,
    syncAfterIndex: options.syncAfterIndex,
    syncAfterOldTextOffset: options.syncAfterOldTextOffset,
    syncAfterFragmentAnchor: options.syncAfterFragmentAnchor,
    syncAfterNewFragmentAnchor: options.syncAfterNewFragmentAnchor,
    pageReuseProbeRadius: options.pageReuseProbeRadius,
    pageReuseRootIndexProbeRadius: options.pageReuseRootIndexProbeRadius,
  });

  const matchedOldPageIndex = findEquivalentPageIndex({
    page: options.page,
    previousLayout: options.previousLayout,
    candidateIndexes,
    textRangeFallbackCandidateIndexes,
    blockIdFallbackCandidateIndexes,
    rootRangeFallbackCandidateIndexes,
    signatureFallbackCandidateIndexes,
    offsetDelta: options.offsetDelta,
    syncAfterFragmentAnchor: options.syncAfterFragmentAnchor,
    syncAfterNewFragmentAnchor: options.syncAfterNewFragmentAnchor,
    createDiff: options.createDiff,
  });

  if (!matchedOldPageIndex || !Number.isFinite(matchedOldPageIndex.matchedOldPageIndex)) {
    return {
      ok: false as const,
      reason: "page-not-equivalent" as const,
      candidateIndexes,
      textRangeFallbackCandidateIndexes,
      blockIdFallbackCandidateIndexes,
      rootRangeFallbackCandidateIndexes,
      signatureFallbackCandidateIndexes,
      fragmentSignatureKey,
      signatureKey,
      syncDiagnostics: createPaginationSyncDiagnostics({
        source: "maybe-sync",
        reason: "page-not-equivalent",
        boundaryAnchor: options.syncAfterFragmentAnchor,
        expectedBoundaryAnchor: options.syncAfterNewFragmentAnchor,
        candidateCount:
          candidateIndexes.length +
          textRangeFallbackCandidateIndexes.length +
          blockIdFallbackCandidateIndexes.length +
          rootRangeFallbackCandidateIndexes.length +
          signatureFallbackCandidateIndexes.length,
        candidateIndexes: candidateIndexes
          .concat(textRangeFallbackCandidateIndexes)
          .concat(blockIdFallbackCandidateIndexes)
          .concat(rootRangeFallbackCandidateIndexes)
          .concat(signatureFallbackCandidateIndexes),
        fragmentSignatureKey,
        signatureKey,
      }),
    };
  }

  return {
    ok: true as const,
    matchedOldPageIndex: Number(matchedOldPageIndex.matchedOldPageIndex),
    matchPass: matchedOldPageIndex.matchPass,
    equivalenceStage: matchedOldPageIndex.equivalenceStage ?? null,
    expectedBoundaryAnchor: matchedOldPageIndex.expectedBoundaryAnchor ?? null,
    candidateIndexes,
    textRangeFallbackCandidateIndexes,
    blockIdFallbackCandidateIndexes,
    rootRangeFallbackCandidateIndexes,
    signatureFallbackCandidateIndexes,
    fragmentSignatureKey,
    signatureKey,
    syncDiagnostics: createPaginationSyncDiagnostics({
      source: "maybe-sync",
      reason: "reuse-ok",
      matchPass: matchedOldPageIndex.matchPass,
      equivalenceStage: matchedOldPageIndex.equivalenceStage ?? null,
      expectedBoundaryAnchor: matchedOldPageIndex.expectedBoundaryAnchor ?? null,
      boundaryAnchor: options.syncAfterFragmentAnchor,
      matchedOldPageIndex: Number(matchedOldPageIndex.matchedOldPageIndex),
      candidateCount:
        candidateIndexes.length +
        textRangeFallbackCandidateIndexes.length +
        blockIdFallbackCandidateIndexes.length +
        rootRangeFallbackCandidateIndexes.length +
        signatureFallbackCandidateIndexes.length,
      candidateIndexes: candidateIndexes
        .concat(textRangeFallbackCandidateIndexes)
        .concat(blockIdFallbackCandidateIndexes)
        .concat(rootRangeFallbackCandidateIndexes)
        .concat(signatureFallbackCandidateIndexes),
      fragmentSignatureKey,
      signatureKey,
    }),
  };
}
