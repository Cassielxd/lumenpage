import { arePagesEquivalent } from "./pageReuseEquivalence.js";
import {
  getPageFragmentAnchorSummary,
  getPageFragmentChainSignature,
  pageHasFragmentAnchor,
} from "./fragmentContinuation.js";
import {
  addFragmentBoundaryTextRangeCandidates,
  addRootRangeCandidates,
  addTextRangeCandidates,
} from "./pageReuseIndex.js";
import { getPageSignature } from "./pageReuseSignature.js";

type CollectPageReuseCandidatesOptions = {
  pageIndex: number;
  page: any;
  previousLayout: any;
  previousPageFirstBlockIdIndex: Map<string, number[]> | null;
  previousPageSignatureIndex: Map<string, number[]> | null;
  previousPageReuseIndex: any;
  syncAfterIndex: number | null;
  syncAfterOldTextOffset: number | null;
  syncAfterFragmentAnchor: string | null;
  syncAfterNewFragmentAnchor: string | null;
  pageReuseProbeRadius: number | null | undefined;
  pageReuseRootIndexProbeRadius: number | null | undefined;
};

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
  syncAfterOldTextOffset,
  syncAfterFragmentAnchor,
  syncAfterNewFragmentAnchor,
  pageReuseProbeRadius,
  pageReuseRootIndexProbeRadius,
}: CollectPageReuseCandidatesOptions) {
  const candidateSet = new Set<number>();
  const textRangeFallbackSet = new Set<number>();
  const blockIdFallbackSet = new Set<number>();
  const rootRangeFallbackSet = new Set<number>();
  const signatureFallbackSet = new Set<number>();
  const maxPageIndex = (previousLayout?.pages?.length ?? 1) - 1;
  const previousFirstFragmentAnchorIndex =
    previousPageReuseIndex?.firstFragmentAnchorIndex instanceof Map
      ? previousPageReuseIndex.firstFragmentAnchorIndex
      : null;
  const previousLastFragmentAnchorIndex =
    previousPageReuseIndex?.lastFragmentAnchorIndex instanceof Map
      ? previousPageReuseIndex.lastFragmentAnchorIndex
      : null;
  const previousFragmentAnchorIndex =
    previousPageReuseIndex?.fragmentAnchorIndex instanceof Map
      ? previousPageReuseIndex.fragmentAnchorIndex
      : null;
  const previousFragmentSignatureIndex =
    previousPageReuseIndex?.fragmentSignatureIndex instanceof Map
      ? previousPageReuseIndex.fragmentSignatureIndex
      : null;
  const addCandidate = (idx: number) => {
    if (!Number.isFinite(idx)) {
      return;
    }
    if (idx < 0 || idx > maxPageIndex) {
      return;
    }
    candidateSet.add(Number(idx));
  };
  const addSignatureFallbackCandidate = (idx: number) => {
    if (!Number.isFinite(idx)) {
      return;
    }
    if (idx < 0 || idx > maxPageIndex) {
      return;
    }
    signatureFallbackSet.add(Number(idx));
  };
  const addTextRangeFallbackCandidate = (idx: number) => {
    if (!Number.isFinite(idx)) {
      return;
    }
    if (idx < 0 || idx > maxPageIndex) {
      return;
    }
    textRangeFallbackSet.add(Number(idx));
  };
  const addBlockIdFallbackCandidate = (idx: number) => {
    if (!Number.isFinite(idx)) {
      return;
    }
    if (idx < 0 || idx > maxPageIndex) {
      return;
    }
    blockIdFallbackSet.add(Number(idx));
  };
  const addRootRangeFallbackCandidate = (idx: number) => {
    if (!Number.isFinite(idx)) {
      return;
    }
    if (idx < 0 || idx > maxPageIndex) {
      return;
    }
    rootRangeFallbackSet.add(Number(idx));
  };

  addCandidate(pageIndex);
  const probeRadius = Number.isFinite(pageReuseProbeRadius)
    ? Math.max(2, Number(pageReuseProbeRadius))
    : 8;
  for (let delta = 1; delta <= probeRadius; delta += 1) {
    addCandidate(pageIndex - delta);
    addCandidate(pageIndex + delta);
  }

  if (syncAfterFragmentAnchor && previousFragmentAnchorIndex) {
    const bySyncAnchor = previousFragmentAnchorIndex.get(syncAfterFragmentAnchor) || [];
    for (const idx of bySyncAnchor) {
      addCandidate(idx);
      addCandidate(idx - 1);
      addCandidate(idx + 1);
    }
  }

  if (syncAfterNewFragmentAnchor && previousFragmentAnchorIndex) {
    const byNewBoundaryAnchor = previousFragmentAnchorIndex.get(syncAfterNewFragmentAnchor) || [];
    for (const idx of byNewBoundaryAnchor) {
      addCandidate(idx);
      addCandidate(idx - 1);
      addCandidate(idx + 1);
    }
  }

  if (Number.isFinite(syncAfterOldTextOffset)) {
    addFragmentBoundaryTextRangeCandidates(
      previousPageReuseIndex,
      Number(syncAfterOldTextOffset),
      addCandidate
    );
    addTextRangeCandidates(
      previousPageReuseIndex,
      Number(syncAfterOldTextOffset),
      addTextRangeFallbackCandidate
    );
  }

  if (Number.isFinite(syncAfterIndex) && Array.isArray(previousLayout?.pages)) {
    const targetRootIndex = Number(syncAfterIndex);
    const rootIndexProbeRadius = Number.isFinite(pageReuseRootIndexProbeRadius)
      ? Math.max(0, Number(pageReuseRootIndexProbeRadius))
      : 2;
    addRootRangeCandidates(
      previousPageReuseIndex,
      targetRootIndex,
      rootIndexProbeRadius,
      addRootRangeFallbackCandidate
    );
  }

  const fragmentAnchorSummary = getPageFragmentAnchorSummary(page);
  const fragmentSignatureKey = String(getPageFragmentChainSignature(page));
  if (fragmentAnchorSummary.lastFragmentAnchor && previousLastFragmentAnchorIndex) {
    const byLastAnchor =
      previousLastFragmentAnchorIndex.get(fragmentAnchorSummary.lastFragmentAnchor) || [];
    for (const idx of byLastAnchor) {
      addCandidate(idx);
    }
  }
  if (fragmentAnchorSummary.firstFragmentAnchor && previousFirstFragmentAnchorIndex) {
    const byFirstAnchor =
      previousFirstFragmentAnchorIndex.get(fragmentAnchorSummary.firstFragmentAnchor) || [];
    for (const idx of byFirstAnchor) {
      addCandidate(idx);
    }
  }
  if (previousFragmentAnchorIndex) {
    for (const anchor of fragmentAnchorSummary.fragmentAnchors) {
      const byAnchor = previousFragmentAnchorIndex.get(anchor) || [];
      for (const idx of byAnchor) {
        addCandidate(idx);
      }
    }
  }
  if (previousFragmentSignatureIndex?.has(fragmentSignatureKey)) {
    const byFragmentSignature = previousFragmentSignatureIndex.get(fragmentSignatureKey) || [];
    for (const idx of byFragmentSignature) {
      addCandidate(idx);
      addCandidate(idx - 1);
      addCandidate(idx + 1);
    }
  }

  const pageFirstBlockId = page?.lines?.[0]?.blockId;
  if (pageFirstBlockId && previousPageFirstBlockIdIndex?.has(pageFirstBlockId)) {
    const byBlockId = previousPageFirstBlockIdIndex.get(pageFirstBlockId) || [];
    for (const idx of byBlockId) {
      addBlockIdFallbackCandidate(idx);
      addBlockIdFallbackCandidate(idx - 1);
      addBlockIdFallbackCandidate(idx + 1);
    }
  }

  const pageLineCount = Array.isArray(page?.lines) ? page.lines.length : 0;
  const pageSignature = getPageSignature(page, 0, false);
  const signatureKey = `${pageLineCount}:${pageSignature}`;
  if (previousPageSignatureIndex?.has(signatureKey)) {
    const bySignature = previousPageSignatureIndex.get(signatureKey) || [];
    for (const idx of bySignature) {
      addSignatureFallbackCandidate(idx);
      addSignatureFallbackCandidate(idx - 1);
      addSignatureFallbackCandidate(idx + 1);
    }
  }

  return {
    candidateIndexes: Array.from(candidateSet.values()),
    textRangeFallbackCandidateIndexes: Array.from(textRangeFallbackSet.values()),
    blockIdFallbackCandidateIndexes: Array.from(blockIdFallbackSet.values()),
    rootRangeFallbackCandidateIndexes: Array.from(rootRangeFallbackSet.values()),
    signatureFallbackCandidateIndexes: Array.from(signatureFallbackSet.values()),
    fragmentSignatureKey,
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
  textRangeFallbackCandidateIndexes?: number[];
  blockIdFallbackCandidateIndexes?: number[];
  rootRangeFallbackCandidateIndexes?: number[];
  signatureFallbackCandidateIndexes?: number[];
  offsetDelta: number;
  syncAfterFragmentAnchor?: string | null;
  syncAfterNewFragmentAnchor?: string | null;
  createDiff: () => any;
}) {
  const tryCandidates = (
    candidateIndexes: number[],
    pass:
      | "expected-new-boundary-anchor"
      | "boundary-anchor-candidate"
      | "fallback"
      | "text-range-fallback"
      | "block-id-fallback"
      | "root-range-fallback"
      | "signature-fallback",
    expectedBoundaryAnchor: string | null = null
  ) => {
    for (const candidateIndex of candidateIndexes) {
      const candidatePage = options.previousLayout?.pages?.[candidateIndex];
      if (!candidatePage) {
        continue;
      }
      const diff = options.createDiff();
      if (
        arePagesEquivalent(options.page, candidatePage, diff, options.offsetDelta, {
          expectedBoundaryAnchor,
        })
      ) {
        return {
          matchedOldPageIndex: Number(candidateIndex),
          matchPass: pass,
          equivalenceStage:
            diff && typeof diff.matchStage === "string" ? diff.matchStage : null,
          expectedBoundaryAnchor,
        } as const;
      }
    }
    return null;
  };

  const expectedBoundaryAnchor =
    typeof options.syncAfterNewFragmentAnchor === "string" &&
    options.syncAfterNewFragmentAnchor.trim().length > 0
      ? options.syncAfterNewFragmentAnchor.trim()
      : null;
  if (expectedBoundaryAnchor) {
    const expectedBoundaryCandidates = options.candidateIndexes.filter((candidateIndex) =>
      pageHasFragmentAnchor(options.previousLayout?.pages?.[candidateIndex], expectedBoundaryAnchor)
    );
    const exactBoundaryMatch = tryCandidates(
      expectedBoundaryCandidates,
      "expected-new-boundary-anchor",
      expectedBoundaryAnchor
    );
    if (exactBoundaryMatch) {
      return exactBoundaryMatch;
    }
  }

  const boundaryAnchorCandidate =
    typeof options.syncAfterFragmentAnchor === "string" && options.syncAfterFragmentAnchor.trim().length > 0
      ? options.syncAfterFragmentAnchor.trim()
      : expectedBoundaryAnchor;
  if (boundaryAnchorCandidate) {
    const boundaryAwareCandidates = options.candidateIndexes.filter((candidateIndex) =>
      pageHasFragmentAnchor(options.previousLayout?.pages?.[candidateIndex], boundaryAnchorCandidate)
    );
    const boundaryAwareMatch = tryCandidates(
      boundaryAwareCandidates,
      "boundary-anchor-candidate",
      boundaryAnchorCandidate
    );
    if (boundaryAwareMatch) {
      return boundaryAwareMatch;
    }
  }

  const fallbackMatch = tryCandidates(options.candidateIndexes, "fallback");
  if (fallbackMatch) {
    return fallbackMatch;
  }

  if (Array.isArray(options.textRangeFallbackCandidateIndexes)) {
    const textRangeFallbackMatch = tryCandidates(
      options.textRangeFallbackCandidateIndexes,
      "text-range-fallback"
    );
    if (textRangeFallbackMatch) {
      return textRangeFallbackMatch;
    }
  }

  if (Array.isArray(options.blockIdFallbackCandidateIndexes)) {
    const blockIdFallbackMatch = tryCandidates(
      options.blockIdFallbackCandidateIndexes,
      "block-id-fallback"
    );
    if (blockIdFallbackMatch) {
      return blockIdFallbackMatch;
    }
  }

  if (Array.isArray(options.rootRangeFallbackCandidateIndexes)) {
    const rootRangeFallbackMatch = tryCandidates(
      options.rootRangeFallbackCandidateIndexes,
      "root-range-fallback"
    );
    if (rootRangeFallbackMatch) {
      return rootRangeFallbackMatch;
    }
  }

  if (Array.isArray(options.signatureFallbackCandidateIndexes)) {
    const signatureFallbackMatch = tryCandidates(
      options.signatureFallbackCandidateIndexes,
      "signature-fallback"
    );
    if (signatureFallbackMatch) {
      return signatureFallbackMatch;
    }
  }

  return null;
}
