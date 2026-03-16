import { getPageSignature } from "./pageReuseSignature";

/**
 * 为旧布局构建页复用索引，加快候选页搜索速度。
 */
export function getOrBuildPageReuseIndex(layout: any) {
  const pages = Array.isArray(layout?.pages) ? layout.pages : null;
  if (!pages || pages.length === 0) {
    return null;
  }
  const cached = layout?.__pageReuseIndex;
  if (
    cached &&
    cached.pageCount === pages.length &&
    cached.firstBlockIdIndex instanceof Map &&
    cached.signatureIndex instanceof Map &&
    Array.isArray(cached.pageRootRanges)
  ) {
    return cached;
  }
  const firstBlockIdIndex = new Map();
  const signatureIndex = new Map();
  const pageRootRanges = [];
  for (let idx = 0; idx < pages.length; idx += 1) {
    const prevPage = pages[idx];
    const firstLine = prevPage?.lines?.[0];
    const firstBlockId = firstLine?.blockId;
    if (firstBlockId) {
      const bucket = firstBlockIdIndex.get(firstBlockId) || [];
      bucket.push(idx);
      firstBlockIdIndex.set(firstBlockId, bucket);
    }
    const lineCount = Array.isArray(prevPage?.lines) ? prevPage.lines.length : 0;
    const sig = getPageSignature(prevPage, 0, false);
    const sigKey = `${lineCount}:${sig}`;
    const sigBucket = signatureIndex.get(sigKey) || [];
    sigBucket.push(idx);
    signatureIndex.set(sigKey, sigBucket);
    pageRootRanges.push({
      min: Number.isFinite(prevPage?.rootIndexMin) ? Number(prevPage.rootIndexMin) : Number.NaN,
      max: Number.isFinite(prevPage?.rootIndexMax) ? Number(prevPage.rootIndexMax) : Number.NaN,
    });
  }
  const index = {
    pageCount: pages.length,
    firstBlockIdIndex,
    signatureIndex,
    pageRootRanges,
  };
  layout.__pageReuseIndex = index;
  return index;
}

/**
 * 按 rootIndex 范围追加候选页，减少跨页同步时的搜索成本。
 */
export function addRootRangeCandidates(
  pageReuseIndex: any,
  targetRootIndex: number,
  radius: number,
  addCandidate: (pageIndex: number) => void
) {
  const ranges = Array.isArray(pageReuseIndex?.pageRootRanges) ? pageReuseIndex.pageRootRanges : null;
  if (!ranges || !ranges.length || !Number.isFinite(targetRootIndex)) {
    return;
  }
  const minTarget = Number(targetRootIndex) - Math.max(0, Number(radius) || 0);
  const maxTarget = Number(targetRootIndex) + Math.max(0, Number(radius) || 0);
  let lo = 0;
  let hi = ranges.length - 1;
  let firstIndex = ranges.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const rangeMax = Number(ranges[mid]?.max);
    if (!Number.isFinite(rangeMax) || rangeMax >= minTarget) {
      firstIndex = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  for (let idx = firstIndex; idx < ranges.length; idx += 1) {
    const rangeMin = Number(ranges[idx]?.min);
    const rangeMax = Number(ranges[idx]?.max);
    if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) {
      continue;
    }
    if (rangeMin > maxTarget) {
      break;
    }
    if (rangeMax < minTarget) {
      continue;
    }
    addCandidate(idx);
    addCandidate(idx - 1);
    addCandidate(idx + 1);
  }
}
