import { cleanupUnslicedDuplicateSlices } from "../fragments/cleanup";
import { cloneAndShiftPages } from "./pageReuseEquivalence";
import { invalidatePageReuseSignature } from "./pageReuseSignature";
import { markReusedPages, populatePageDerivedState } from "./pageState";

/**
 * 在主布局循环结束后统一处理尾页复用、重复切片清理和页面几何补齐。
 */
export function finalizeLayoutPages(options: {
  pages: any[];
  shouldStop: boolean;
  previousLayout: any;
  syncFromIndex: number | null;
  offsetDelta: number;
  appendGhostTrace: (trace: any[] | null, event: any) => void;
  ghostTrace: any[] | null;
}) {
  let pages = Array.isArray(options.pages) ? options.pages.slice() : [];
  let reusedTailCount = 0;

  if (options.shouldStop && options.previousLayout && options.syncFromIndex != null) {
    const reusedTail = cloneAndShiftPages(
      options.previousLayout.pages.slice(options.syncFromIndex + 1),
      options.offsetDelta
    );
    reusedTailCount = reusedTail.length;
    options.appendGhostTrace(options.ghostTrace, {
      event: "reuse-tail-applied",
      syncFromIndex: options.syncFromIndex,
      reusedTailPages: reusedTail.length,
      offsetDelta: options.offsetDelta,
    });
    pages.push(...markReusedPages(reusedTail));
  }

  const cleanupScanUntilPageIndex =
    options.shouldStop && options.syncFromIndex != null
      ? Math.min(pages.length - 1, options.syncFromIndex + 1)
      : null;

  pages = cleanupUnslicedDuplicateSlices(pages, {
    scanUntilPageIndex: cleanupScanUntilPageIndex,
  });
  if (Number.isFinite(cleanupScanUntilPageIndex)) {
    for (let idx = 0; idx <= Number(cleanupScanUntilPageIndex); idx += 1) {
      invalidatePageReuseSignature(pages[idx]);
    }
  }

  pages = pages.filter((page) => page?.lines?.length > 0);
  for (const currentPage of pages) {
    populatePageDerivedState(currentPage, { force: true });
  }

  return {
    pages,
    reusedTailCount,
    cleanupScanUntilPageIndex,
  };
}
