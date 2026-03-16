import { ENABLE_SAME_INDEX_TAIL_REUSE } from "./pageReuseFlags";
import { arePagesEquivalent } from "./pageReuseEquivalence";
import {
  hashFragmentContinuationState,
  readLineFragmentContinuationState,
} from "./fragmentContinuation";
import { getObjectSignature, hashNumber, hashString } from "./signature";

type FinalizePageReuseDecisionOptions = {
  cascadePagination: boolean;
  cascadeFromPageIndex: number | null;
  pageIndex: number;
  page: any;
  previousLayout: any;
  offsetDelta: number;
};

type FinalizePageReuseDecision =
  | {
      reason: "same-index-boundary-reuse";
      syncFromIndex: number;
      trace: {
        event: "same-index-boundary-reuse";
        pageIndex: number;
        nextExitToken: string | null;
      };
    }
  | {
      reason: "same-index-tail-reuse";
      syncFromIndex: number;
      trace: {
        event: "same-index-tail-reuse";
        pageIndex: number;
      };
    };

function buildPageExitToken(page: any, offsetDelta = 0) {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  const line = lines.length > 0 ? lines[lines.length - 1] : null;
  if (!line) {
    return "empty";
  }

  const totalOffsetDelta =
    (Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0) +
    Number(offsetDelta || 0);
  const continuation = readLineFragmentContinuationState(line);
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
  hash = hashFragmentContinuationState(hash, continuation);
  hash = hashNumber(hash, getObjectSignature(line.containers || null, new WeakMap()));
  return String(hash >>> 0);
}

/**
 * 判断当前页在结束时是否可以直接复用旧布局中的同索引页边界。
 */
export function resolveFinalizePageReuseDecision({
  cascadePagination,
  cascadeFromPageIndex,
  pageIndex,
  page,
  previousLayout,
  offsetDelta,
}: FinalizePageReuseDecisionOptions): FinalizePageReuseDecision | null {
  if (!cascadePagination || cascadeFromPageIndex == null || pageIndex < cascadeFromPageIndex) {
    return null;
  }

  const previousPage = previousLayout?.pages?.[pageIndex];
  if (!previousPage) {
    return null;
  }

  const nextExitToken = buildPageExitToken(page, 0);
  const previousExitToken = buildPageExitToken(previousPage, offsetDelta);
  if (nextExitToken === previousExitToken) {
    return {
      reason: "same-index-boundary-reuse",
      syncFromIndex: pageIndex,
      trace: {
        event: "same-index-boundary-reuse",
        pageIndex,
        nextExitToken,
      },
    };
  }

  if (ENABLE_SAME_INDEX_TAIL_REUSE && arePagesEquivalent(page, previousPage, null, offsetDelta)) {
    return {
      reason: "same-index-tail-reuse",
      syncFromIndex: pageIndex,
      trace: {
        event: "same-index-tail-reuse",
        pageIndex,
      },
    };
  }

  return null;
}

/**
 * 判断渐进分页是否已经达到允许继续布局的最大页数。
 */
export function shouldStopAtProgressiveCutoff(options: {
  cascadePagination: boolean;
  previousLayout: any;
  cascadeStopPageIndex: number | null;
  pageIndex: number;
}) {
  return (
    options.cascadePagination &&
    !!options.previousLayout &&
    Number.isFinite(options.cascadeStopPageIndex) &&
    options.pageIndex >= Number(options.cascadeStopPageIndex)
  );
}
