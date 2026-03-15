import { addRootRangeCandidates, arePagesEquivalent, getPageSignature } from "./pageReuse";

type CollectPageReuseCandidatesOptions = {
  pageIndex: number;
  page: any;
  previousLayout: any;
  previousPageFirstBlockIdIndex: Map<string, number[]> | null;
  previousPageSignatureIndex: Map<string, number[]> | null;
  previousPageReuseIndex: any;
  syncAfterIndex: number | null;
  pageReuseProbeRadius: number | null | undefined;
  pageReuseRootIndexProbeRadius: number | null | undefined;
};

type MaybeSyncPrecheckOptions = {
  candidateReuseEnabled: boolean;
  canSync: boolean;
  passedChangedRange: boolean;
  previousLayout: any;
  pageIndex: number;
};

/**
 * 统一判断当前页是否具备跨页同步的前置条件。
 */
export function resolveMaybeSyncPrecheck({
  candidateReuseEnabled,
  canSync,
  passedChangedRange,
  previousLayout,
  pageIndex,
}: MaybeSyncPrecheckOptions) {
  if (!candidateReuseEnabled) {
    return {
      ok: false as const,
      reason: "candidate-reuse-disabled" as const,
      trace: {
        event: "maybe-sync-skipped" as const,
        reason: "candidate-reuse-disabled" as const,
        pageIndex,
        canSync,
        passedChangedRange,
      },
    };
  }

  if (!canSync || !passedChangedRange || !previousLayout) {
    return {
      ok: false as const,
      reason: "precheck-failed" as const,
      perfSnapshot: {
        canSync,
        passedChangedRange,
        hasPrev: !!previousLayout,
      },
    };
  }

  const oldPage = previousLayout.pages?.[pageIndex];
  if (!oldPage) {
    return {
      ok: false as const,
      reason: "old-page-missing" as const,
    };
  }

  return {
    ok: true as const,
    oldPage,
  };
}

/**
 * 收集当前页用于跨页同步的候选旧页索引，并返回对应的签名键。
 */
export function collectPageReuseCandidates({
  pageIndex,
  page,
  previousLayout,
  previousPageFirstBlockIdIndex,
  previousPageSignatureIndex,
  previousPageReuseIndex,
  syncAfterIndex,
  pageReuseProbeRadius,
  pageReuseRootIndexProbeRadius,
}: CollectPageReuseCandidatesOptions) {
  const candidateSet = new Set<number>();
  const maxPageIndex = (previousLayout?.pages?.length ?? 1) - 1;
  const addCandidate = (idx: number) => {
    if (!Number.isFinite(idx)) {
      return;
    }
    if (idx < 0 || idx > maxPageIndex) {
      return;
    }
    candidateSet.add(Number(idx));
  };

  addCandidate(pageIndex);
  const probeRadius = Number.isFinite(pageReuseProbeRadius)
    ? Math.max(2, Number(pageReuseProbeRadius))
    : 8;
  for (let delta = 1; delta <= probeRadius; delta += 1) {
    addCandidate(pageIndex - delta);
    addCandidate(pageIndex + delta);
  }

  const pageFirstBlockId = page?.lines?.[0]?.blockId;
  if (pageFirstBlockId && previousPageFirstBlockIdIndex?.has(pageFirstBlockId)) {
    const byBlockId = previousPageFirstBlockIdIndex.get(pageFirstBlockId) || [];
    for (const idx of byBlockId) {
      addCandidate(idx);
      addCandidate(idx - 1);
      addCandidate(idx + 1);
    }
  }

  if (Number.isFinite(syncAfterIndex) && Array.isArray(previousLayout?.pages)) {
    const targetRootIndex = Number(syncAfterIndex);
    const rootIndexProbeRadius = Number.isFinite(pageReuseRootIndexProbeRadius)
      ? Math.max(0, Number(pageReuseRootIndexProbeRadius))
      : 2;
    addRootRangeCandidates(previousPageReuseIndex, targetRootIndex, rootIndexProbeRadius, addCandidate);
  }

  const pageLineCount = Array.isArray(page?.lines) ? page.lines.length : 0;
  const pageSignature = getPageSignature(page, 0, false);
  const signatureKey = `${pageLineCount}:${pageSignature}`;
  if (previousPageSignatureIndex?.has(signatureKey)) {
    const bySignature = previousPageSignatureIndex.get(signatureKey) || [];
    for (const idx of bySignature) {
      addCandidate(idx);
      addCandidate(idx - 1);
      addCandidate(idx + 1);
    }
  }

  return {
    candidateIndexes: Array.from(candidateSet.values()),
    signatureKey,
  };
}

/**
 * 在候选旧页中查找与当前页视觉等价的页面索引。
 */
export function findEquivalentPageIndex(options: {
  page: any;
  previousLayout: any;
  candidateIndexes: number[];
  offsetDelta: number;
  createDiff: () => any;
}) {
  for (const candidateIndex of options.candidateIndexes) {
    const candidatePage = options.previousLayout?.pages?.[candidateIndex];
    if (!candidatePage) {
      continue;
    }
    const diff = options.createDiff();
    if (arePagesEquivalent(options.page, candidatePage, diff, options.offsetDelta)) {
      return Number(candidateIndex);
    }
  }
  return null;
}

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
