import { getPageSignature } from "./pageReuseSignature.js";
import {
  getPageFragmentAnchorSummary,
  getPageFragmentBoundaryRanges,
  getPageFragmentChainSignature,
} from "./fragmentContinuation.js";

const addIndexEntry = (index: Map<string, number[]>, key: string | null, pageIndex: number) => {
  if (!key) {
    return;
  }
  const bucket = index.get(key) || [];
  bucket.push(pageIndex);
  index.set(key, bucket);
};

const getPageTextRange = (page: any) => {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    const candidates = [line?.start, line?.blockStart, line?.end];
    for (const value of candidates) {
      if (!Number.isFinite(value)) {
        continue;
      }
      const nextValue = Number(value);
      if (nextValue < min) {
        min = nextValue;
      }
      if (nextValue > max) {
        max = nextValue;
      }
    }
  }
  return {
    min: Number.isFinite(min) ? min : Number.NaN,
    max: Number.isFinite(max) ? max : Number.NaN,
  };
};

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
    cached.firstFragmentAnchorIndex instanceof Map &&
    cached.lastFragmentAnchorIndex instanceof Map &&
    cached.fragmentAnchorIndex instanceof Map &&
    cached.fragmentSignatureIndex instanceof Map &&
    Array.isArray(cached.pageFragmentAnchors) &&
    Array.isArray(cached.pageFragmentBoundaryRanges) &&
    Array.isArray(cached.pageTextRanges) &&
    Array.isArray(cached.pageRootRanges)
  ) {
    return cached;
  }
  const firstBlockIdIndex = new Map();
  const signatureIndex = new Map();
  const firstFragmentAnchorIndex = new Map();
  const lastFragmentAnchorIndex = new Map();
  const fragmentAnchorIndex = new Map();
  const fragmentSignatureIndex = new Map();
  const pageFragmentAnchors = [];
  const pageFragmentBoundaryRanges = [];
  const pageTextRanges = [];
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
    const fragmentAnchorSummary = getPageFragmentAnchorSummary(prevPage);
    const fragmentSignature = getPageFragmentChainSignature(prevPage);
    pageFragmentAnchors.push(fragmentAnchorSummary);
    pageFragmentBoundaryRanges.push(getPageFragmentBoundaryRanges(prevPage));
    addIndexEntry(firstFragmentAnchorIndex, fragmentAnchorSummary.firstFragmentAnchor, idx);
    addIndexEntry(lastFragmentAnchorIndex, fragmentAnchorSummary.lastFragmentAnchor, idx);
    for (const anchor of fragmentAnchorSummary.fragmentAnchors) {
      addIndexEntry(fragmentAnchorIndex, anchor, idx);
    }
    addIndexEntry(fragmentSignatureIndex, String(fragmentSignature), idx);
    pageTextRanges.push(getPageTextRange(prevPage));
    pageRootRanges.push({
      min: Number.isFinite(prevPage?.rootIndexMin) ? Number(prevPage.rootIndexMin) : Number.NaN,
      max: Number.isFinite(prevPage?.rootIndexMax) ? Number(prevPage.rootIndexMax) : Number.NaN,
    });
  }
  const index = {
    pageCount: pages.length,
    firstBlockIdIndex,
    signatureIndex,
    firstFragmentAnchorIndex,
    lastFragmentAnchorIndex,
    fragmentAnchorIndex,
    fragmentSignatureIndex,
    pageFragmentAnchors,
    pageFragmentBoundaryRanges,
    pageTextRanges,
    pageRootRanges,
  };
  layout.__pageReuseIndex = index;
  return index;
}

/**
 * 按旧布局中的文本偏移范围追加候选页，用于在变更边界附近优先命中同一条 fragment 链。
 */
export function addTextRangeCandidates(
  pageReuseIndex: any,
  targetTextOffset: number,
  addCandidate: (pageIndex: number) => void
) {
  const ranges = Array.isArray(pageReuseIndex?.pageTextRanges) ? pageReuseIndex.pageTextRanges : null;
  if (!ranges || !ranges.length || !Number.isFinite(targetTextOffset)) {
    return;
  }
  const target = Number(targetTextOffset);
  let lo = 0;
  let hi = ranges.length - 1;
  let firstIndex = ranges.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const rangeMax = Number(ranges[mid]?.max);
    if (!Number.isFinite(rangeMax) || rangeMax >= target) {
      firstIndex = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  let matched = false;
  for (let idx = Math.max(0, firstIndex); idx < ranges.length; idx += 1) {
    const rangeMin = Number(ranges[idx]?.min);
    const rangeMax = Number(ranges[idx]?.max);
    if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) {
      continue;
    }
    if (rangeMin > target) {
      break;
    }
    if (rangeMax < target) {
      continue;
    }
    matched = true;
    addCandidate(idx);
    addCandidate(idx - 1);
    addCandidate(idx + 1);
  }

  if (matched) {
    return;
  }

  const fallbackIndex =
    firstIndex < ranges.length ? Math.max(0, firstIndex) : Math.max(0, ranges.length - 1);
  addCandidate(fallbackIndex);
  addCandidate(fallbackIndex - 1);
  addCandidate(fallbackIndex + 1);
}

/**
 * 按 fragment 边界的文本范围追加候选页，优先命中同一条 continuation 链附近的旧页。
 */
export function addFragmentBoundaryTextRangeCandidates(
  pageReuseIndex: any,
  targetTextOffset: number,
  addCandidate: (pageIndex: number) => void
) {
  const ranges = Array.isArray(pageReuseIndex?.pageFragmentBoundaryRanges)
    ? pageReuseIndex.pageFragmentBoundaryRanges
    : null;
  if (!ranges || !ranges.length || !Number.isFinite(targetTextOffset)) {
    return;
  }
  const target = Number(targetTextOffset);
  let matched = false;
  for (let pageIndex = 0; pageIndex < ranges.length; pageIndex += 1) {
    const pageRanges = Array.isArray(ranges[pageIndex]) ? ranges[pageIndex] : [];
    const hasMatch = pageRanges.some((range) => {
      const rangeMin = Number(range?.min);
      const rangeMax = Number(range?.max);
      return Number.isFinite(rangeMin) && Number.isFinite(rangeMax) && rangeMin <= target && rangeMax >= target;
    });
    if (!hasMatch) {
      continue;
    }
    matched = true;
    addCandidate(pageIndex);
    addCandidate(pageIndex - 1);
    addCandidate(pageIndex + 1);
  }
  if (matched) {
    return;
  }

  let nearestPageIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let pageIndex = 0; pageIndex < ranges.length; pageIndex += 1) {
    const pageRanges = Array.isArray(ranges[pageIndex]) ? ranges[pageIndex] : [];
    for (const range of pageRanges) {
      const rangeMin = Number(range?.min);
      const rangeMax = Number(range?.max);
      if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) {
        continue;
      }
      const distance =
        target < rangeMin ? rangeMin - target : target > rangeMax ? target - rangeMax : 0;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPageIndex = pageIndex;
      }
    }
  }
  if (nearestPageIndex >= 0) {
    addCandidate(nearestPageIndex);
    addCandidate(nearestPageIndex - 1);
    addCandidate(nearestPageIndex + 1);
  }
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
