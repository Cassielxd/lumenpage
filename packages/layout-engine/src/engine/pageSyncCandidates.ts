import { arePagesEquivalent } from "./pageReuseEquivalence";
import { addRootRangeCandidates } from "./pageReuseIndex";
import { getPageSignature } from "./pageReuseSignature";

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
