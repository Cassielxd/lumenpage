export type PlaygroundDebugFlags = {
  permissionMode: "full" | "comment" | "readonly";
  debugAllSmoke: boolean;
  debugP0Smoke: boolean;
  debugTablePagination: boolean;
  debugTableSmoke: boolean;
  debugTableBehaviorSmoke: boolean;
  debugListSmoke: boolean;
  debugListBehaviorSmoke: boolean;
  debugBlockOutlineSmoke: boolean;
  debugDragSmoke: boolean;
  debugDragActionSmoke: boolean;
  debugSelectionImeSmoke: boolean;
  debugImeActionSmoke: boolean;
  debugSelectionBoundarySmoke: boolean;
  debugToolSmoke: boolean;
  debugPasteSmoke: boolean;
  debugHistorySmoke: boolean;
  debugMappingSmoke: boolean;
  debugCoordsSmoke: boolean;
  debugScrollSmoke: boolean;
  debugReadonlySmoke: boolean;
  debugDocRoundtripSmoke: boolean;
  debugMarkdownIoSmoke: boolean;
  debugHtmlIoSmoke: boolean;
  debugLinkSmoke: boolean;
  debugPerfBudgetSmoke: boolean;
  usePerfDoc: boolean;
  debugTimingLogs: boolean;
  debugLegacyConfigSmoke: boolean;
  debugDuplicateDecorations: boolean;
  debugDevTools: boolean;
  enableInputRules: boolean;
  enableGapCursor: boolean;
  debugPerf: boolean;
  enablePaginationWorker: boolean;
  forcePaginationWorker: boolean;
};

const resolveQueryParam = (key: string) => {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const value = params.get(key);
  if (value == null) {
    return null;
  }
  return value.trim();
};

const resolvePermissionMode = (): "full" | "comment" | "readonly" => {
  const value = resolveQueryParam("permissionMode");
  const normalized = (value || "").toLowerCase();
  if (normalized === "comment") {
    return "comment";
  }
  if (normalized === "readonly" || normalized === "read-only" || normalized === "read_only") {
    return "readonly";
  }
  return "full";
};

export const resolveDebugFlag = (key: string) => {
  const value = resolveQueryParam(key);
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

// Playground 调试开关集中管理，避免散落在页面组件中。
export const createPlaygroundDebugFlags = (): PlaygroundDebugFlags => ({
  permissionMode: resolvePermissionMode(),
  debugAllSmoke: resolveDebugFlag("allSmoke"),
  debugP0Smoke: resolveDebugFlag("p0Smoke"),
  debugTablePagination: resolveDebugFlag("debugTablePagination"),
  debugTableSmoke: resolveDebugFlag("tableSmoke"),
  debugTableBehaviorSmoke: resolveDebugFlag("tableBehaviorSmoke"),
  debugListSmoke: resolveDebugFlag("listSmoke"),
  debugListBehaviorSmoke: resolveDebugFlag("listBehaviorSmoke"),
  debugBlockOutlineSmoke: resolveDebugFlag("blockOutlineSmoke"),
  debugDragSmoke: resolveDebugFlag("dragSmoke"),
  debugDragActionSmoke: resolveDebugFlag("dragActionSmoke"),
  debugSelectionImeSmoke: resolveDebugFlag("selectionImeSmoke"),
  debugImeActionSmoke: resolveDebugFlag("imeActionSmoke"),
  debugSelectionBoundarySmoke: resolveDebugFlag("selectionBoundarySmoke"),
  debugToolSmoke: resolveDebugFlag("toolSmoke"),
  debugPasteSmoke: resolveDebugFlag("pasteSmoke"),
  debugHistorySmoke: resolveDebugFlag("historySmoke"),
  debugMappingSmoke: resolveDebugFlag("mappingSmoke"),
  debugCoordsSmoke: resolveDebugFlag("coordsSmoke"),
  debugScrollSmoke: resolveDebugFlag("scrollSmoke"),
  debugReadonlySmoke: resolveDebugFlag("readonlySmoke"),
  debugDocRoundtripSmoke: resolveDebugFlag("docRoundtripSmoke"),
  debugMarkdownIoSmoke: resolveDebugFlag("markdownIoSmoke"),
  debugHtmlIoSmoke: resolveDebugFlag("htmlIoSmoke"),
  debugLinkSmoke: resolveDebugFlag("linkSmoke"),
  debugPerfBudgetSmoke: resolveDebugFlag("perfBudgetSmoke"),
  usePerfDoc: resolveDebugFlag("perfDoc"),
  debugTimingLogs: resolveDebugFlag("timingLogs"),
  debugLegacyConfigSmoke: resolveDebugFlag("legacyConfigSmoke"),
  debugDuplicateDecorations: resolveDebugFlag("dupDecor"),
  debugDevTools: resolveDebugFlag("devTools"),
  enableInputRules: resolveDebugFlag("inputRules"),
  enableGapCursor: resolveDebugFlag("gapCursor"),
  debugPerf: resolveDebugFlag("debugPerf"),
  enablePaginationWorker:
    resolveDebugFlag("paginationWorker") || resolveDebugFlag("workerUsed"),
  forcePaginationWorker: resolveDebugFlag("paginationWorkerForce"),
});

// 编辑器布局配置集中到单独函数，便于复用和后续扩展。
export const createCanvasSettings = (
  debugPerf: boolean,
  enablePaginationWorker = false,
  forcePaginationWorker = false
) => ({
  pageWidth: 794,
  pageHeight: 1123,
  pageGap: 24,
  margin: {
    top: 72,
    right: 72,
    bottom: 72,
    left: 72,
  },
  lineHeight: 26,
  blockSpacing: 8,
  paragraphSpacingBefore: 0,
  paragraphSpacingAfter: 8,
  font: "16px Arial",
  wrapTolerance: 2,
  pageBuffer: 1,
  maxPageCache: 32,
  debugPerf,
  disablePageReuse: false,
  paginationWorker: (enablePaginationWorker
    ? {
        enabled: true,
        mode: "experimental-runs",
        timeoutMs: 5000,
        force: forcePaginationWorker,
        useForDocChanged: true,
        useForInitial: false,
        incremental: {
          enabled: true,
          maxPages: 24,
          settleDelayMs: 120,
        },
      }
    : {
        enabled: false,
      }) as any,
});
