import { materializePageGeometry } from "../pageGeometry.js";
import { getPageSignature } from "./pageReuseSignature.js";
import {
  applyContinuationMetadataPatch,
  buildPageBoundaryAnchorToken,
  getPageFragmentAnchorSummary,
  getPageFragmentChainSignature,
  hashFragmentContinuationState,
  pageHasFragmentAnchor,
  readLineFragmentContinuationState,
} from "./fragmentContinuation.js";
import { getObjectSignature, hashNumber, hashString } from "./signature.js";
import {
  clearPageRenderSignature,
  getPageOffsetDelta,
  getPageSourcePageIndex,
  setPageOffsetDelta,
  setPageSourcePageIndex,
} from "../runtimeMetadata.js";

/**
 * 生成页面结束状态的 token，用于校验复用页与新布局页是否一致。
 */
export function getPageExitToken(page: any, offsetDelta = 0) {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  const fragmentAnchorSummary = getPageFragmentAnchorSummary(page);
  const anchorLineIndex =
    fragmentAnchorSummary.lastFragmentAnchorLineIndex != null
      ? fragmentAnchorSummary.lastFragmentAnchorLineIndex
      : lines.length - 1;
  const line = anchorLineIndex >= 0 ? lines[anchorLineIndex] : null;
  if (!line) {
    return "empty";
  }
  const totalOffsetDelta = getPageOffsetDelta(page) + Number(offsetDelta || 0);
  const continuation = readLineFragmentContinuationState(line);
  let hash = 17;
  hash = hashString(hash, "page-exit");
  hash = hashString(hash, line.blockType || "");
  hash = hashString(hash, line.blockId || "");
  hash = hashString(hash, fragmentAnchorSummary.lastFragmentAnchor || "");
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
  hash = hashFragmentContinuationState(hash, continuation);
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
  const hasIdentity =
    typeof continuation.fragmentIdentity === "string" ||
    typeof continuation.continuationToken === "string" ||
    (continuation.carryState && typeof continuation.carryState === "object");
  if (!needsFromPrev && !needsHasNext && !hasIdentity) {
    return lines;
  }
  const nextLines = lines.slice();
  const updateLineAt = (index: number, edge: "start" | "end") => {
    if (index < 0 || index >= nextLines.length) {
      return;
    }
    const current = nextLines[index];
    nextLines[index] = applyContinuationMetadataPatch(current, continuation, edge);
  };
  if (needsFromPrev) {
    updateLineAt(0, "start");
  }
  if (needsHasNext) {
    updateLineAt(nextLines.length - 1, "end");
  } else if (hasIdentity) {
    updateLineAt(0, "start");
    if (nextLines.length > 1) {
      updateLineAt(nextLines.length - 1, "end");
    }
  }
  return nextLines;
}

/**
 * 比较新旧页面在给定 offset 偏移下是否可视等价。
 */
export function arePagesEquivalent(
  nextPage: any,
  prevPage: any,
  debug: any,
  offsetDelta = 0,
  options: {
    expectedBoundaryAnchor?: string | null;
  } = {}
) {
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
  const expectedBoundaryAnchor =
    typeof options.expectedBoundaryAnchor === "string" && options.expectedBoundaryAnchor.trim()
      ? options.expectedBoundaryAnchor.trim()
      : null;
  if (expectedBoundaryAnchor && !pageHasFragmentAnchor(prevPage, expectedBoundaryAnchor)) {
    if (debug) {
      debug.reason = "expected-boundary-anchor";
      debug.expectedBoundaryAnchor = expectedBoundaryAnchor;
      debug.nextHasExpectedBoundaryAnchor = pageHasFragmentAnchor(nextPage, expectedBoundaryAnchor);
      debug.prevHasExpectedBoundaryAnchor = false;
    }
    return false;
  }
  const nextFragmentSummary = getPageFragmentAnchorSummary(nextPage);
  const prevFragmentSummary = getPageFragmentAnchorSummary(prevPage);
  const nextFragmentSignature = getPageFragmentChainSignature(nextPage);
  const prevFragmentSignature = getPageFragmentChainSignature(prevPage);
  const hasFragmentSummary =
    nextFragmentSummary.fragmentAnchors.length > 0 || prevFragmentSummary.fragmentAnchors.length > 0;
  if (hasFragmentSummary && nextFragmentSignature !== prevFragmentSignature) {
    if (debug) {
      debug.reason = "fragment-signature";
      debug.nextFragmentSignature = nextFragmentSignature;
      debug.prevFragmentSignature = prevFragmentSignature;
      debug.nextFragmentAnchors = nextFragmentSummary.fragmentAnchors.slice(0, 8);
      debug.prevFragmentAnchors = prevFragmentSummary.fragmentAnchors.slice(0, 8);
    }
    return false;
  }
  const nextVisualSig = getPageSignature(nextPage, 0, false);
  const prevVisualSig = getPageSignature(prevPage, 0, false);
  if (expectedBoundaryAnchor) {
    const nextBoundaryToken = buildPageBoundaryAnchorToken(nextPage, expectedBoundaryAnchor);
    const prevBoundaryToken = buildPageBoundaryAnchorToken(prevPage, expectedBoundaryAnchor);
    if (nextBoundaryToken === prevBoundaryToken && nextVisualSig === prevVisualSig) {
      if (debug) {
        debug.matchStage = "boundary-token";
        debug.expectedBoundaryAnchor = expectedBoundaryAnchor;
        debug.nextBoundaryToken = nextBoundaryToken;
        debug.prevBoundaryToken = prevBoundaryToken;
      }
      return true;
    }
  }
  if (nextVisualSig !== prevVisualSig) {
    if (debug) {
      debug.reason = "visual-signature";
      debug.nextVisualSig = nextVisualSig;
      debug.prevVisualSig = prevVisualSig;
    }
    return false;
  }
  const nextSig = getPageSignature(nextPage, 0, true);
  const prevSig = getPageSignature(prevPage, offsetDelta, true);
  if (nextSig === prevSig) {
    if (debug) {
      debug.matchStage = "absolute-signature";
    }
    return true;
  }
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
  return false;
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
    const next: any = {
      ...page,
      __materializedShiftedLines: undefined,
      __materializedShiftedLinesDelta: undefined,
    };
    setPageSourcePageIndex(
      next,
      getPageSourcePageIndex(page) ??
        (Number.isFinite(page?.index) ? Number(page.index) : null)
    );
    setPageOffsetDelta(next, getPageOffsetDelta(page) + delta);
    clearPageRenderSignature(next);
    materializePageGeometry(next);
    return next;
  });
}
