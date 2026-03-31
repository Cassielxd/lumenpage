import { ENABLE_SAME_INDEX_TAIL_REUSE } from "./pageReuseFlags";
import { arePagesEquivalent } from "./pageReuseEquivalence";
import {
  createPaginationSyncDiagnostics,
  type PaginationSyncDiagnostics,
} from "./paginationDiagnostics";
import {
  buildPageBoundaryAnchorToken,
  getPagePreferredBoundaryAnchor,
  getPageFragmentAnchorSummary,
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
  preferredBoundaryAnchor: string | null;
};

const pageHasVisualBlock = (page: any) => {
  const lines = Array.isArray(page?.lines) ? page.lines : [];
  for (const line of lines) {
    const capabilities = line?.blockAttrs?.layoutCapabilities;
    if (capabilities?.["visual-block"] === true) {
      return true;
    }
    if (Array.isArray(line?.fragmentOwners)) {
      for (const owner of line.fragmentOwners) {
        if (owner?.meta?.layoutCapabilities?.["visual-block"] === true) {
          return true;
        }
      }
    }
  }
  return false;
};

const pageHasFragmentAnchors = (page: any) =>
  getPageFragmentAnchorSummary(page).fragmentAnchors.length > 0;

type FinalizePageReuseDecision =
  | {
      reason: "same-index-boundary-reuse";
      syncFromIndex: number;
      trace: {
        event: "same-index-boundary-reuse";
        pageIndex: number;
        nextExitToken: string | null;
        boundaryToken: string | null;
        boundaryAnchor: string | null;
        equivalenceStage: "boundary-token" | "exit-token";
        matchPass:
          | "same-index-boundary-anchor-token"
          | "same-index-boundary-fragment-token"
          | "same-index-boundary-exit-token";
      };
      diagnostics: PaginationSyncDiagnostics;
    }
  | {
      reason: "same-index-tail-reuse";
      syncFromIndex: number;
      trace: {
        event: "same-index-tail-reuse";
        pageIndex: number;
        matchPass:
          | "same-index-tail-boundary-anchor"
          | "same-index-tail-fragment-anchor"
          | "same-index-tail-fallback";
        expectedBoundaryAnchor: string | null;
        equivalenceStage: string | null;
      };
      diagnostics: PaginationSyncDiagnostics;
    };

function buildPageExitToken(page: any, offsetDelta = 0) {
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

  const totalOffsetDelta =
    (Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0) +
    Number(offsetDelta || 0);
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
 * 判断当前页在结束时是否可以直接复用旧布局中的同索引页边界。
 */
export function resolveFinalizePageReuseDecision({
  cascadePagination,
  cascadeFromPageIndex,
  pageIndex,
  page,
  previousLayout,
  offsetDelta,
  preferredBoundaryAnchor,
}: FinalizePageReuseDecisionOptions): FinalizePageReuseDecision | null {
  if (!cascadePagination || cascadeFromPageIndex == null || pageIndex < cascadeFromPageIndex) {
    return null;
  }

  // finalizeCurrentPage only runs while there is still overflow content to place on a next page.
  // If we are already on the old layout tail, stopping here would drop that overflow because there
  // is no reused tail page available to carry it.
  const previousPageCount = previousLayout?.pages?.length ?? 0;
  if (pageIndex >= previousPageCount - 1) {
    return null;
  }

  const previousPage = previousLayout?.pages?.[pageIndex];
  if (!previousPage) {
    return null;
  }

  const boundaryAnchor = getPagePreferredBoundaryAnchor(page, preferredBoundaryAnchor);
  const nextBoundaryToken = buildPageBoundaryAnchorToken(page, preferredBoundaryAnchor);
  const previousBoundaryToken = buildPageBoundaryAnchorToken(previousPage, preferredBoundaryAnchor);
  const hasVisualBlock = pageHasVisualBlock(page) || pageHasVisualBlock(previousPage);
  const hasFragmentAnchors =
    pageHasFragmentAnchors(page) || pageHasFragmentAnchors(previousPage);
  if (!hasVisualBlock && !hasFragmentAnchors && nextBoundaryToken === previousBoundaryToken) {
    return {
      reason: "same-index-boundary-reuse",
      syncFromIndex: pageIndex,
      trace: {
        event: "same-index-boundary-reuse",
        pageIndex,
        nextExitToken: null,
        boundaryToken: nextBoundaryToken,
        boundaryAnchor,
        equivalenceStage: "boundary-token",
        matchPass: preferredBoundaryAnchor
          ? "same-index-boundary-anchor-token"
          : "same-index-boundary-fragment-token",
      },
      diagnostics: createPaginationSyncDiagnostics({
        source: "same-index-boundary-reuse",
        reason: "same-index-boundary-reuse",
        matchPass: preferredBoundaryAnchor
          ? "same-index-boundary-anchor-token"
          : "same-index-boundary-fragment-token",
        equivalenceStage: "boundary-token",
        expectedBoundaryAnchor: preferredBoundaryAnchor,
        boundaryAnchor,
        matchedOldPageIndex: pageIndex,
      }),
    };
  }

  const nextExitToken = buildPageExitToken(page, 0);
  const previousExitToken = buildPageExitToken(previousPage, offsetDelta);
  if (!hasVisualBlock && !hasFragmentAnchors && nextExitToken === previousExitToken) {
    return {
      reason: "same-index-boundary-reuse",
      syncFromIndex: pageIndex,
      trace: {
        event: "same-index-boundary-reuse",
        pageIndex,
        nextExitToken,
        boundaryToken: nextBoundaryToken,
        boundaryAnchor,
        equivalenceStage: "exit-token",
        matchPass: "same-index-boundary-exit-token",
      },
      diagnostics: createPaginationSyncDiagnostics({
        source: "same-index-boundary-reuse",
        reason: "same-index-boundary-reuse",
        matchPass: "same-index-boundary-exit-token",
        equivalenceStage: "exit-token",
        expectedBoundaryAnchor: preferredBoundaryAnchor,
        boundaryAnchor,
        matchedOldPageIndex: pageIndex,
      }),
    };
  }

  const expectedBoundaryAnchor =
    boundaryAnchor ||
    getPageFragmentAnchorSummary(page).lastFragmentAnchor ||
    null;
  const equivalenceDebug: any = {};
  if (
    ENABLE_SAME_INDEX_TAIL_REUSE &&
    arePagesEquivalent(page, previousPage, equivalenceDebug, offsetDelta, {
      expectedBoundaryAnchor,
    })
  ) {
    const matchPass = expectedBoundaryAnchor
      ? preferredBoundaryAnchor
        ? "same-index-tail-boundary-anchor"
        : "same-index-tail-fragment-anchor"
      : "same-index-tail-fallback";
    return {
      reason: "same-index-tail-reuse",
      syncFromIndex: pageIndex,
      trace: {
        event: "same-index-tail-reuse",
        pageIndex,
        matchPass,
        expectedBoundaryAnchor,
        equivalenceStage:
          typeof equivalenceDebug?.matchStage === "string" ? equivalenceDebug.matchStage : null,
      },
      diagnostics: createPaginationSyncDiagnostics({
        source: "same-index-tail-reuse",
        reason: "same-index-tail-reuse",
        matchPass,
        equivalenceStage:
          typeof equivalenceDebug?.matchStage === "string" ? equivalenceDebug.matchStage : null,
        expectedBoundaryAnchor,
        boundaryAnchor,
        matchedOldPageIndex: pageIndex,
      }),
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
