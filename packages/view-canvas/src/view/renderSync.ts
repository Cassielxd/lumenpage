import { createLayoutPassCoordinator } from "./layoutPassCoordinator";
import { createLayoutApplyCoordinator } from "./layoutApplyCoordinator";
import { createRenderFrameCoordinator } from "./renderFrameCoordinator";
import { createStateSyncCoordinator } from "./stateSyncCoordinator";

export const createRenderSync = ({
  getEditorState,
  setEditorState,
  applyTransaction,
  layoutPipeline,
  renderer,
  spacer,
  scrollArea,
  status,
  inputEl,
  getText,
  getTextLength,
  clampOffset,
  docPosToTextOffset,
  getSelectionOffsets,
  getDecorations,
  selectionToRects,
  buildLayoutIndex,
  coordsAtPos,
  logSelection,
  getCaretOffset,
  setCaretOffsetValue,
  getCaretRect,
  setCaretRect,
  setPreferredX,
  getPendingPreferredUpdate,
  setPendingPreferredUpdate,
  getLayout,
  setLayout,
  getLayoutIndex,
  setLayoutIndex,
  getRafId,
  setRafId,
  setInputPosition,
  syncNodeViewOverlays,
  getPendingChangeSummary,
  clearPendingChangeSummary,
  getPendingSteps,
  clearPendingSteps,
  resolvePageWidth,
  queryEditorProp,
  scrollIntoViewAtPos,
  paginationTiming = false,
  renderTiming = false,
}) => {
  void paginationTiming;
  void renderTiming;
  void getText;
  void getPendingSteps;

  let layoutPassCoordinator: ReturnType<typeof createLayoutPassCoordinator> | null = null;
  let layoutApplyCoordinator: ReturnType<typeof createLayoutApplyCoordinator> | null = null;
  let renderFrameCoordinator: ReturnType<typeof createRenderFrameCoordinator> | null = null;
  let stateSyncCoordinator: ReturnType<typeof createStateSyncCoordinator> | null = null;

  const emitPerfLog = (type: string, summary: Record<string, unknown>) => {
    if (layoutPipeline?.settings?.debugPerf !== true) {
      return;
    }
    const totalPassMs =
      type === "layout-pass" && Number.isFinite(summary?.totalPassMs)
        ? Number(summary.totalPassMs)
        : 0;
    const totalApplyMs =
      type === "layout-apply" && Number.isFinite(summary?.totalApplyMs)
        ? Number(summary.totalApplyMs)
        : 0;
    const shouldConsoleLog =
      (type === "layout-pass" && totalPassMs >= 50) ||
      (type === "layout-apply" && totalApplyMs >= 8);
    if (shouldConsoleLog) {
      console.info(`[perf][${type}]`, summary);
    }
    if (typeof window !== "undefined") {
      const globalWindow = window as typeof window & {
        __lumenPerfLogs?: Array<Record<string, unknown>>;
        __copyLumenPerfLogs?: () => string;
      };
      const logs = Array.isArray(globalWindow.__lumenPerfLogs) ? globalWindow.__lumenPerfLogs : [];
      logs.push({
        type,
        timestamp: new Date().toISOString(),
        ...summary,
      });
      if (logs.length > 400) {
        logs.splice(0, logs.length - 400);
      }
      globalWindow.__lumenPerfLogs = logs;
      globalWindow.__copyLumenPerfLogs = () => JSON.stringify(logs, null, 2);
    }
  };

  const hasPendingLayoutWork = () => layoutPassCoordinator?.isPending() === true;

  const scheduleRender = () => {
    renderFrameCoordinator?.scheduleRender();
  };

  const scheduleLayout = () => {
    layoutPassCoordinator?.scheduleLayout();
  };

  const updateStatus = () => {
    stateSyncCoordinator?.updateStatus();
  };

  const requestScrollIntoView = (pos?: number | null) => {
    stateSyncCoordinator?.requestScrollIntoView(pos);
  };

  const flushPendingScrollIntoView = () => {
    stateSyncCoordinator?.flushPendingScrollIntoView();
  };

  const flushPendingScrollIntoViewIfReady = () => {
    stateSyncCoordinator?.flushPendingScrollIntoViewIfReady();
  };

  renderFrameCoordinator = createRenderFrameCoordinator({
    renderer,
    scrollArea,
    getRafId,
    setRafId,
    getLayout: () => getLayout?.() ?? null,
    getLayoutIndex: () => getLayoutIndex?.() ?? null,
    getLayoutVersion: () => layoutPassCoordinator?.getVersion() ?? 0,
    getEditorState,
    getTextLength,
    clampOffset,
    docPosToTextOffset,
    getSelectionOffsets,
    selectionToRects,
    getDecorations,
    coordsAtPos,
    getCaretRect,
    getCaretOffset,
    setCaretRect,
    setInputPosition,
    setPreferredX,
    queryEditorProp,
    syncNodeViewOverlays,
  });

  const updateCaret = (updatePreferred: boolean) => {
    renderFrameCoordinator?.updateCaret(updatePreferred);
  };

  stateSyncCoordinator = createStateSyncCoordinator({
    getEditorState,
    setEditorState,
    applyTransaction,
    getLayout: () => getLayout?.() ?? null,
    inputEl,
    status,
    queryEditorProp,
    scrollIntoViewAtPos,
    clampOffset,
    docPosToTextOffset,
    setCaretOffsetValue,
    getPendingPreferredUpdate,
    setPendingPreferredUpdate,
    hasPendingLayoutWork,
    updateCaret,
    logSelection,
    scheduleRender,
    scheduleLayout,
  });

  layoutApplyCoordinator = createLayoutApplyCoordinator({
    getEditorState,
    getLayout: () => getLayout?.() ?? null,
    getLayoutIndex: () => getLayoutIndex?.() ?? null,
    getLayoutVersion: () => layoutPassCoordinator?.getVersion() ?? 0,
    setLayout,
    setLayoutIndex,
    buildLayoutIndex,
    spacer,
    clampOffset,
    docPosToTextOffset,
    setCaretOffsetValue,
    updateCaret,
    updateStatus,
    flushPendingScrollIntoView,
    scheduleRender,
    emitPerfLog,
    onLayoutApplied: (layout) => {
      renderFrameCoordinator?.onLayoutApplied(layout);
    },
  });

  layoutPassCoordinator = createLayoutPassCoordinator({
    getEditorState,
    getLayout: () => getLayout?.() ?? null,
    getLayoutIndex: () => getLayoutIndex?.() ?? null,
    getPendingChangeSummary,
    clearPendingChangeSummary,
    clearPendingSteps,
    resolvePageWidth,
    layoutPipeline,
    docPosToTextOffset,
    clampOffset,
    emitPerfLog,
    onSkipLayoutPass: () => {
      updateStatus();
      flushPendingScrollIntoViewIfReady();
      scheduleRender();
    },
    onApplyLayout: ({ layout, version, changeSummary, isLayoutProgressive }) => {
      layoutApplyCoordinator?.applyLayout(layout, version, changeSummary, isLayoutProgressive);
    },
    onAfterLayoutPass: flushPendingScrollIntoViewIfReady,
  });

  const updateLayout = () => {
    layoutPassCoordinator?.updateLayout();
  };

  const syncAfterStateChange = () => {
    stateSyncCoordinator?.syncAfterStateChange();
  };

  const dispatchTransaction = (tr) => {
    stateSyncCoordinator?.dispatchTransaction(tr);
  };

  return {
    updateStatus,
    scheduleRender,
    scheduleLayout,
    updateCaret,
    updateLayout,
    syncAfterStateChange,
    dispatchTransaction,
    requestScrollIntoView,
    isLayoutPending: hasPendingLayoutWork,
    destroy: () => {
      renderFrameCoordinator?.destroy();
      layoutPassCoordinator?.destroy();
    },
  };
};
