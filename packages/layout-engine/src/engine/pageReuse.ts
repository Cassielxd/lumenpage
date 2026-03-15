import { materializePageGeometry } from "../pageGeometry";
import { getObjectSignature, hashNumber, hashString } from "./signature";

export const PAGE_REUSE_SIGNATURE_VERSION = 5;
export const ENABLE_CROSS_PAGE_CANDIDATE_REUSE = false;
export const ENABLE_SAME_INDEX_TAIL_REUSE = false;
export const ENABLE_RESUME_FROM_ANCHOR_REUSE = false;

/**
 * 判断是否开启 ghost trace 调试，用于排查页复用与同步问题。
 */
export function isGhostTraceEnabled(settings: any) {
  return (
    settings?.debugGhostTrace === true ||
    (typeof globalThis !== "undefined" &&
      (globalThis as typeof globalThis & { __lumenGhostTraceEnabled?: boolean })
        .__lumenGhostTraceEnabled === true)
  );
}

/**
 * 追加一条 ghost trace 事件，并限制调试记录的最大长度。
 */
export function appendGhostTrace(trace: any[] | null, event: any) {
  if (!Array.isArray(trace)) {
    return;
  }
  trace.push(event);
  if (trace.length > 80) {
    trace.splice(0, trace.length - 80);
  }
}

/**
 * 清理页面上的复用签名缓存，强制下次重新计算。
 */
export function invalidatePageReuseSignature(page: any) {
  if (!page || typeof page !== "object") {
    return;
  }
  delete page.__reuseVisualSignature;
  delete page.__reuseVisualSignatureVersion;
  delete page.__reuseVisualSignatureBuilder;
  delete page.__reuseVisualSignatureBuilderLineCount;
}

/**
 * 计算单条布局行的视觉签名，供页复用比较使用。
 */
function getLineVisualSignature(line: any, objectSignatureCache = new WeakMap<object, number>()) {
  if (
    Number(line?.__reuseVisualSignatureVersion) === PAGE_REUSE_SIGNATURE_VERSION &&
    typeof line?.__reuseVisualSignature === "number"
  ) {
    return Number(line.__reuseVisualSignature);
  }
  let hash = 17;
  hash = hashNumber(hash, line?.x);
  hash = hashNumber(hash, line?.y);
  hash = hashNumber(hash, line?.width);
  hash = hashNumber(hash, line?.lineHeight);
  hash = hashNumber(hash, line?.blockSignature);
  hash = hashString(hash, line?.blockType || "");
  hash = hashString(hash, line?.blockId || "");
  hash = hashString(hash, line?.text || "");
  hash = hashNumber(hash, getObjectSignature(line?.blockAttrs || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.tableMeta || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.tableOwnerMeta || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.containers || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.fragmentOwners || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.listMarker || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.imageMeta || null, objectSignatureCache));
  hash = hashNumber(hash, getObjectSignature(line?.videoMeta || null, objectSignatureCache));
  if (Array.isArray(line?.runs)) {
    for (const run of line.runs) {
      hash = hashString(hash, run?.text || "");
      hash = hashString(hash, run?.font || "");
      hash = hashString(hash, run?.color || "");
      hash = hashNumber(hash, run?.width);
      hash = hashNumber(hash, run?.underline ? 1 : 0);
      hash = hashString(hash, run?.underlineStyle || "");
      hash = hashString(hash, run?.underlineColor || "");
      hash = hashNumber(hash, run?.strike ? 1 : 0);
      hash = hashString(hash, run?.strikeColor || "");
      hash = hashNumber(hash, run?.shiftY);
      hash = hashNumber(hash, run?.backgroundRadius);
      hash = hashNumber(hash, run?.backgroundPaddingX);
      hash = hashString(hash, run?.linkHref || "");
      hash = hashString(hash, run?.annotationKey || "");
      hash = hashNumber(hash, getObjectSignature(run?.annotations || null, objectSignatureCache));
      hash = hashString(hash, run?.styleKey || "");
      hash = hashNumber(hash, getObjectSignature(run?.extras || null, objectSignatureCache));
      hash = hashNumber(
        hash,
        getObjectSignature(run?.drawInstructions || null, objectSignatureCache)
      );
      hash =
        typeof run?.background === "string"
          ? hashString(hash, run.background)
          : hashNumber(hash, getObjectSignature(run?.background || null, objectSignatureCache));
    }
  }
  const signature = hash >>> 0;
  if (line && typeof line === "object") {
    line.__reuseVisualSignature = signature;
    line.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
  }
  return signature;
}

/**
 * 获取页面增量签名构建器，必要时根据现有行重新计算。
 */
function ensurePageReuseSignatureBuilder(page: any) {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  if (
    Number(page?.__reuseVisualSignatureVersion) === PAGE_REUSE_SIGNATURE_VERSION &&
    typeof page?.__reuseVisualSignatureBuilder === "number" &&
    Number(page?.__reuseVisualSignatureBuilderLineCount) === lines.length
  ) {
    return Number(page.__reuseVisualSignatureBuilder);
  }
  const objectSignatureCache = new WeakMap<object, number>();
  let hash = 0;
  for (const line of lines) {
    hash = hashNumber(hash, getLineVisualSignature(line, objectSignatureCache));
  }
  if (page && typeof page === "object") {
    page.__reuseVisualSignature = hash >>> 0;
    page.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
    page.__reuseVisualSignatureBuilder = hash >>> 0;
    page.__reuseVisualSignatureBuilderLineCount = lines.length;
  }
  return hash >>> 0;
}

/**
 * 在页面末尾追加一条新行后，增量更新复用签名。
 */
export function appendPageReuseSignature(page: any, line: any) {
  if (!page || typeof page !== "object") {
    return;
  }
  const currentHash = ensurePageReuseSignatureBuilder(page);
  const nextHash = hashNumber(currentHash, getLineVisualSignature(line, new WeakMap())) >>> 0;
  const nextLineCount = Array.isArray(page.lines) ? page.lines.length + 1 : 1;
  page.__reuseVisualSignature = nextHash;
  page.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
  page.__reuseVisualSignatureBuilder = nextHash;
  page.__reuseVisualSignatureBuilderLineCount = nextLineCount;
}

/**
 * 计算页面签名，可选择是否把绝对 offset 一并纳入比较。
 */
/**
 * 计算页面签名，可供主流程直接读取复用候选键。
 */
export function getPageSignature(page: any, offsetDelta = 0, includeAbsoluteOffsets = true) {
  if (
    includeAbsoluteOffsets === false &&
    Number(page?.__reuseVisualSignatureVersion) === PAGE_REUSE_SIGNATURE_VERSION &&
    typeof page?.__reuseVisualSignature === "number"
  ) {
    return Number(page.__reuseVisualSignature);
  }
  const shift = (value: any) =>
    Number.isFinite(value) ? Number(value) + Number(offsetDelta || 0) : value;
  const objectSignatureCache = new WeakMap<object, number>();
  let hash = 0;
  if (!page?.lines) {
    return hash;
  }
  for (const line of page.lines) {
    const lineOffsetDelta = Number.isFinite(line?.__offsetDelta)
      ? Number(line.__offsetDelta) + Number(offsetDelta || 0)
      : Number(offsetDelta || 0);
    if (!includeAbsoluteOffsets) {
      hash = hashNumber(hash, getLineVisualSignature(line, objectSignatureCache));
      continue;
    }
    hash = hashNumber(hash, shift(line.start));
    hash = hashNumber(hash, shift(line.end));
    hash = hashNumber(hash, shift(line.blockStart));
    hash = hashNumber(hash, line.x);
    hash = hashNumber(hash, line.y);
    hash = hashNumber(hash, line.width);
    hash = hashNumber(hash, line.lineHeight);
    hash = hashNumber(hash, line.blockSignature);
    hash = hashString(hash, line.blockType || "");
    hash = hashString(hash, line.blockId || "");
    hash = hashString(hash, line.text || "");
    hash = hashNumber(hash, getObjectSignature(line.blockAttrs || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.tableMeta || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.tableOwnerMeta || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.containers || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.fragmentOwners || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.listMarker || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.imageMeta || null, objectSignatureCache));
    hash = hashNumber(hash, getObjectSignature(line.videoMeta || null, objectSignatureCache));
    if (line.runs) {
      for (const run of line.runs) {
        hash = hashNumber(
          hash,
          Number.isFinite(run?.start) ? Number(run.start) + lineOffsetDelta : run?.start
        );
        hash = hashNumber(
          hash,
          Number.isFinite(run?.end) ? Number(run.end) + lineOffsetDelta : run?.end
        );
        hash = hashString(hash, run.text || "");
        hash = hashString(hash, run.font || "");
        hash = hashString(hash, run.color || "");
        hash = hashNumber(hash, run.width);
        hash = hashNumber(hash, run.underline ? 1 : 0);
        hash = hashString(hash, run.underlineStyle || "");
        hash = hashString(hash, run.underlineColor || "");
        hash = hashNumber(hash, run.strike ? 1 : 0);
        hash = hashString(hash, run.strikeColor || "");
        hash = hashNumber(hash, run.shiftY);
        hash = hashNumber(hash, run.backgroundRadius);
        hash = hashNumber(hash, run.backgroundPaddingX);
        hash = hashString(hash, run.linkHref || "");
        hash = hashString(hash, run.annotationKey || "");
        hash = hashNumber(hash, getObjectSignature(run.annotations || null, objectSignatureCache));
        hash = hashString(hash, run.styleKey || "");
        hash = hashNumber(hash, getObjectSignature(run.extras || null, objectSignatureCache));
        hash = hashNumber(
          hash,
          getObjectSignature(run.drawInstructions || null, objectSignatureCache)
        );
        hash =
          typeof run.background === "string"
            ? hashString(hash, run.background)
            : hashNumber(hash, getObjectSignature(run.background || null, objectSignatureCache));
      }
    }
  }
  if (includeAbsoluteOffsets === false && page) {
    page.__reuseVisualSignature = hash >>> 0;
    page.__reuseVisualSignatureVersion = PAGE_REUSE_SIGNATURE_VERSION;
    page.__reuseVisualSignatureBuilder = hash >>> 0;
    page.__reuseVisualSignatureBuilderLineCount = Array.isArray(page.lines) ? page.lines.length : 0;
  }
  return hash;
}

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

/**
 * 读取单行的跨页续接状态，统一 table 和普通切片字段。
 */
function readLineContinuationState(line: any) {
  const attrs = line?.blockAttrs || {};
  const tableMeta = line?.tableOwnerMeta || line?.tableMeta || {};
  return {
    fromPrev:
      !!attrs.sliceFromPrev || !!attrs.tableSliceFromPrev || !!tableMeta.continuedFromPrev,
    hasNext:
      !!attrs.sliceHasNext || !!attrs.tableSliceHasNext || !!tableMeta.continuesAfter,
    rowSplit:
      !!attrs.sliceRowSplit || !!attrs.tableRowSplit || !!tableMeta.rowSplit,
  };
}

/**
 * 生成页面结束状态的 token，用于校验复用页与新布局页是否一致。
 */
export function getPageExitToken(page: any, offsetDelta = 0) {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  const line = lines.length > 0 ? lines[lines.length - 1] : null;
  if (!line) {
    return "empty";
  }
  const totalOffsetDelta =
    (Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0) +
    Number(offsetDelta || 0);
  const continuation = readLineContinuationState(line);
  let hash = 17;
  hash = hashString(hash, "page-exit");
  hash = hashString(hash, line.blockType || "");
  hash = hashString(hash, line.blockId || "");
  hash = hashNumber(hash, Number.isFinite(line.rootIndex) ? Number(line.rootIndex) : -1);
  hash = hashNumber(hash, Number.isFinite(line.blockSignature) ? Number(line.blockSignature) : 0);
  hash = hashNumber(
    hash,
    Number.isFinite(line.blockStart) ? Number(line.blockStart) + totalOffsetDelta : Number.NaN
  );
  hash = hashNumber(
    hash,
    Number.isFinite(line.end) ? Number(line.end) + totalOffsetDelta : Number.NaN
  );
  hash = hashNumber(hash, continuation.fromPrev ? 1 : 0);
  hash = hashNumber(hash, continuation.hasNext ? 1 : 0);
  hash = hashNumber(hash, continuation.rowSplit ? 1 : 0);
  hash = hashNumber(hash, getObjectSignature(line.containers || null, new WeakMap()));
  return String(hash >>> 0);
}

/**
 * 把 continuation 标记重新应用到切片结果，保证续页状态不丢失。
 */
export function applyFragmentContinuation(lines: any[], continuation: any) {
  if (!Array.isArray(lines) || lines.length === 0 || !continuation) {
    return lines;
  }
  const needsFromPrev = continuation.fromPrev === true || continuation.rowSplit === true;
  const needsHasNext = continuation.hasNext === true || continuation.rowSplit === true;
  if (!needsFromPrev && !needsHasNext) {
    return lines;
  }
  const nextLines = lines.slice();
  const updateLineAt = (index: number, patch: Record<string, any>) => {
    if (index < 0 || index >= nextLines.length) {
      return;
    }
    const current = nextLines[index];
    nextLines[index] = {
      ...current,
      blockAttrs: {
        ...(current?.blockAttrs || {}),
        ...patch,
      },
    };
  };
  if (needsFromPrev) {
    updateLineAt(0, {
      sliceFromPrev: continuation.fromPrev === true,
      sliceRowSplit: continuation.rowSplit === true,
    });
  }
  if (needsHasNext) {
    updateLineAt(nextLines.length - 1, {
      sliceHasNext: continuation.hasNext === true,
      sliceRowSplit: continuation.rowSplit === true,
    });
  }
  return nextLines;
}

/**
 * 比较新旧页面在给定 offset 偏移下是否可视等价。
 */
export function arePagesEquivalent(nextPage: any, prevPage: any, debug: any, offsetDelta = 0) {
  if (!nextPage || !prevPage) {
    if (debug) {
      debug.reason = "missing-page";
    }
    return false;
  }
  const nextLines = nextPage.lines || [];
  const prevLines = prevPage.lines || [];
  if (nextLines.length !== prevLines.length) {
    if (debug) {
      debug.reason = "line-count";
      debug.nextLines = nextLines.length;
      debug.prevLines = prevLines.length;
    }
    return false;
  }
  const nextSig = getPageSignature(nextPage, 0, true);
  const prevSig = getPageSignature(prevPage, offsetDelta, true);
  if (nextSig !== prevSig && debug) {
    debug.reason = "signature";
    debug.nextSig = nextSig;
    debug.prevSig = prevSig;
    const sample = [];
    for (let i = 0; i < Math.min(3, nextLines.length); i += 1) {
      sample.push({
        index: i,
        next: {
          start: nextLines[i]?.start,
          end: nextLines[i]?.end,
          blockStart: nextLines[i]?.blockStart,
          x: nextLines[i]?.x,
          y: nextLines[i]?.y,
          width: nextLines[i]?.width,
          lineHeight: nextLines[i]?.lineHeight,
          blockType: nextLines[i]?.blockType,
          blockId: nextLines[i]?.blockId,
          text: nextLines[i]?.text,
        },
        prev: {
          start:
            Number.isFinite(prevLines[i]?.start) && Number.isFinite(offsetDelta)
              ? prevLines[i]?.start + offsetDelta
              : prevLines[i]?.start,
          end:
            Number.isFinite(prevLines[i]?.end) && Number.isFinite(offsetDelta)
              ? prevLines[i]?.end + offsetDelta
              : prevLines[i]?.end,
          blockStart:
            Number.isFinite(prevLines[i]?.blockStart) && Number.isFinite(offsetDelta)
              ? prevLines[i]?.blockStart + offsetDelta
              : prevLines[i]?.blockStart,
          x: prevLines[i]?.x,
          y: prevLines[i]?.y,
          width: prevLines[i]?.width,
          lineHeight: prevLines[i]?.lineHeight,
          blockType: prevLines[i]?.blockType,
          blockId: prevLines[i]?.blockId,
          text: prevLines[i]?.text,
        },
      });
    }
    debug.sample = sample;
  }
  return nextSig === prevSig;
}

/**
 * 克隆一批页面，并把偏移增量挂到页面级别，供尾页复用使用。
 */
export function cloneAndShiftPages(pages: any[], offsetDelta: number) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return [];
  }
  const delta = Number.isFinite(offsetDelta) ? Number(offsetDelta) : 0;
  return pages.map((page) => {
    const next = {
      ...page,
      __sourcePageIndex: Number.isFinite(page?.__sourcePageIndex)
        ? Number(page.__sourcePageIndex)
        : Number.isFinite(page?.index)
          ? Number(page.index)
          : null,
      __pageOffsetDelta:
        (Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0) + delta,
      __signature: undefined,
      __signatureVersion: undefined,
      __materializedShiftedLines: undefined,
      __materializedShiftedLinesDelta: undefined,
    };
    materializePageGeometry(next);
    return next;
  });
}
