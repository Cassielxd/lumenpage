import { createLayoutPassCoordinator } from "./layoutPassCoordinator";
import { createLayoutApplyCoordinator } from "./layoutApplyCoordinator";
import { createRenderFrameCoordinator } from "./renderFrameCoordinator";
import { createRenderSyncPerfLog } from "./renderSyncPerfLog";
import { createRenderSyncScheduling } from "./renderSyncScheduling";
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

  const { emitPerfLog } = createRenderSyncPerfLog({
    layoutPipeline,
  });

  const scheduling = createRenderSyncScheduling({
    renderer,
    getLayout: () => getLayout?.() ?? null,
    getPendingChangeSummary,
    getRafId,
    setRafId,
    getLayoutPassCoordinator: () => layoutPassCoordinator,
    getRenderFrameCoordinator: () => renderFrameCoordinator,
  });

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
    hasPendingLayoutWork: scheduling.hasPendingLayoutWork,
    updateCaret,
    logSelection,
    scheduleRender: scheduling.scheduleRender,
    scheduleLayout: scheduling.scheduleLayout,
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
    scheduleRender: scheduling.scheduleRender,
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
      scheduling.scheduleRender();
    },
    onApplyLayout: ({ layout, version, changeSummary, isLayoutProgressive }) => {
      layoutApplyCoordinator?.applyLayout(layout, version, changeSummary, isLayoutProgressive);
    },
    onAfterLayoutPass: flushPendingScrollIntoViewIfReady,
  });

  const syncAfterStateChange = () => {
    stateSyncCoordinator?.syncAfterStateChange();
  };

  const dispatchTransaction = (tr) => {
    stateSyncCoordinator?.dispatchTransaction(tr);
  };

  return {
    updateStatus,
    scheduleRender: scheduling.scheduleRender,
    scheduleLayout: scheduling.scheduleLayout,
    updateCaret,
    updateLayout: scheduling.updateLayout,
    syncAfterStateChange,
    dispatchTransaction,
    requestScrollIntoView,
    isLayoutPending: scheduling.hasPendingLayoutWork,
    destroy: () => {
      renderFrameCoordinator?.destroy();
      layoutPassCoordinator?.destroy();
    },
  };
};
