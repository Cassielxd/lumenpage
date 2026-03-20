import type { PaginationSyncDiagnostics } from "./paginationDiagnostics";

/**
 * 在布局结束后补齐 perf 字段，并生成统一的调试摘要。
 */
export function finalizeLayoutPerf(options: {
  perf: any;
  now: () => number;
  pages: any[];
  previousLayout: any;
  changeSummary: any;
  syncAfterIndex: number | null;
  syncAfterTextOffset: number | null;
  syncAfterOldTextOffset: number | null;
  syncAfterNewFragmentAnchor: string | null;
  canSync: boolean;
  passedChangedRange: boolean;
  passedChangedFragmentBoundary: boolean;
  syncFromIndex: number | null;
  syncMatchPass: string | null;
  syncDiagnostics: PaginationSyncDiagnostics | null;
  resumeFromAnchor: boolean;
  resumeAnchorPageIndex: number | null;
  resumeAnchorLineIndex: number | null;
  resumeAnchorMatchKey: string | null;
  resumeAnchorSkippedReason: string | null;
  reusedPrefixPages: number;
  reusedPrefixLines: number;
}) {
  const { perf } = options;
  if (!perf) {
    return null;
  }

  if (!options.previousLayout) {
    perf.reuseReason = "no-previous-layout";
  } else if (!options.changeSummary) {
    perf.reuseReason = "no-change-summary";
  } else if (!options.changeSummary.docChanged) {
    perf.reuseReason = "no-doc-changed";
  } else {
    perf.reuseReason = "eligible";
  }

  perf.syncAfterIndex = options.syncAfterIndex;
  perf.syncAfterTextOffset = options.syncAfterTextOffset;
  perf.syncAfterOldTextOffset = options.syncAfterOldTextOffset;
  perf.syncAfterNewFragmentAnchor = options.syncAfterNewFragmentAnchor;
  perf.canSync = options.canSync;
  perf.passedChangedRange = options.passedChangedRange;
  perf.passedChangedFragmentBoundary = options.passedChangedFragmentBoundary;
  perf.syncFromIndex = options.syncFromIndex;
  perf.syncMatchPass = options.syncMatchPass;
  perf.syncDiagnostics = options.syncDiagnostics;
  perf.resumeFromAnchor = options.resumeFromAnchor;
  perf.resumeAnchorPageIndex = options.resumeAnchorPageIndex;
  perf.resumeAnchorLineIndex = options.resumeAnchorLineIndex;
  perf.resumeAnchorMatchKey = options.resumeAnchorMatchKey;
  perf.resumeAnchorSkippedReason = options.resumeAnchorSkippedReason;
  perf.reusedPrefixPages = options.reusedPrefixPages;
  perf.reusedPrefixLines = options.reusedPrefixLines;
  perf.pages = options.pages.length;

  const duration = options.now() - perf.start;
  const cacheHitRate = perf.blocks > 0 ? Math.round((perf.cachedBlocks / perf.blocks) * 100) : 0;
  return {
    ms: Math.round(duration),
    pages: perf.pages,
    blocks: perf.blocks,
    cachedBlocks: perf.cachedBlocks,
    blockCacheHitRate: `${cacheHitRate}%`,
    lines: perf.lines,
    measureCalls: perf.measureCalls,
    measureChars: perf.measureChars,
    reusedPages: perf.reusedPages,
    reuseReason: perf.reuseReason,
    syncAfterIndex: perf.syncAfterIndex,
    syncAfterTextOffset: perf.syncAfterTextOffset,
    syncAfterOldTextOffset: perf.syncAfterOldTextOffset,
    syncAfterNewFragmentAnchor: perf.syncAfterNewFragmentAnchor,
    canSync: perf.canSync,
    passedChangedRange: perf.passedChangedRange,
    passedChangedFragmentBoundary: perf.passedChangedFragmentBoundary,
    syncFromIndex: perf.syncFromIndex,
    syncMatchPass: perf.syncMatchPass,
    syncDiagnostics: perf.syncDiagnostics,
    resumeFromAnchor: perf.resumeFromAnchor,
    resumeAnchorPageIndex: perf.resumeAnchorPageIndex,
    resumeAnchorLineIndex: perf.resumeAnchorLineIndex,
    resumeAnchorMatchKey: perf.resumeAnchorMatchKey,
    resumeAnchorSkippedReason: perf.resumeAnchorSkippedReason,
    reusedPrefixPages: perf.reusedPrefixPages,
    reusedPrefixLines: perf.reusedPrefixLines,
    maybeSyncCalled: perf.maybeSyncCalled,
    maybeSyncReason: perf.maybeSyncReason,
    disablePageReuse: perf.disablePageReuse,
    progressiveTruncated: perf.progressiveTruncated,
    cascadeMaxPages: perf.cascadeMaxPages,
    optionsPrevPages: perf.optionsPrevPages,
    maybeSyncFailSnapshot: perf.maybeSyncFailSnapshot,
    breakLinesMs: Math.round(perf.breakLinesMs),
    layoutLeafMs: Math.round(perf.layoutLeafMs),
  };
}
