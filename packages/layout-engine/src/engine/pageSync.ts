import { collectPageReuseCandidates, findEquivalentPageIndex } from "./pageSyncCandidates";
import { resolveMaybeSyncPrecheck } from "./pageSyncPrecheck";

export * from "./pageSyncCandidates";
export * from "./pageSyncPrecheck";

/**
 * 统一解析当前页是否可以与旧布局中的某一页对齐。
 */
export function resolveMaybeSyncDecision(options: {
  candidateReuseEnabled: boolean;
  canSync: boolean;
  passedChangedRange: boolean;
  previousLayout: any;
  pageIndex: number;
  page: any;
  previousPageFirstBlockIdIndex: Map<string, number[]> | null;
  previousPageSignatureIndex: Map<string, number[]> | null;
  previousPageReuseIndex: any;
  syncAfterIndex: number | null;
  pageReuseProbeRadius: number | null | undefined;
  pageReuseRootIndexProbeRadius: number | null | undefined;
  offsetDelta: number;
  createDiff: () => any;
}) {
  const precheck = resolveMaybeSyncPrecheck({
    candidateReuseEnabled: options.candidateReuseEnabled,
    canSync: options.canSync,
    passedChangedRange: options.passedChangedRange,
    previousLayout: options.previousLayout,
    pageIndex: options.pageIndex,
  });
  if (!precheck.ok) {
    return {
      ok: false as const,
      reason: precheck.reason,
      trace: "trace" in precheck ? precheck.trace : null,
      perfSnapshot: "perfSnapshot" in precheck ? precheck.perfSnapshot : null,
    };
  }

  const { candidateIndexes, signatureKey } = collectPageReuseCandidates({
    pageIndex: options.pageIndex,
    page: options.page,
    previousLayout: options.previousLayout,
    previousPageFirstBlockIdIndex: options.previousPageFirstBlockIdIndex,
    previousPageSignatureIndex: options.previousPageSignatureIndex,
    previousPageReuseIndex: options.previousPageReuseIndex,
    syncAfterIndex: options.syncAfterIndex,
    pageReuseProbeRadius: options.pageReuseProbeRadius,
    pageReuseRootIndexProbeRadius: options.pageReuseRootIndexProbeRadius,
  });

  const matchedOldPageIndex = findEquivalentPageIndex({
    page: options.page,
    previousLayout: options.previousLayout,
    candidateIndexes,
    offsetDelta: options.offsetDelta,
    createDiff: options.createDiff,
  });

  if (!Number.isFinite(matchedOldPageIndex)) {
    return {
      ok: false as const,
      reason: "page-not-equivalent" as const,
      candidateIndexes,
      signatureKey,
    };
  }

  return {
    ok: true as const,
    matchedOldPageIndex: Number(matchedOldPageIndex),
    candidateIndexes,
    signatureKey,
  };
}
