import {
  applyTransaction,
  docPosToTextOffset,
  docToOffsetText,
  getDocTextLength,
  getSelectionOffsets,
  textOffsetToDocPos,
} from "../../core/index.js";
import { buildLayoutIndex } from "../layoutIndex.js";
import { coordsAtPos, posAtCoords } from "../posIndex.js";
import { selectionToRects } from "../render/selection.js";
import { createRenderSync } from "../renderSync.js";
import { createA11yStatusUpdater } from "./a11y.js";
import { createCoordinateHelpers } from "./coords.js";
import { createDecorationResolver } from "./decorations.js";
import { applyDefaultA11y } from "./dom.js";
import { createViewAttributeApplier } from "./propsState.js";
import { scrollViewIntoView } from "./publicApi.js";
import { createDebugLoggers, createRuntimeHelpers } from "./runtimeHelpers.js";

export const createEditorViewSyncRuntime = ({
  view,
  viewProps,
  dom,
  basePageWidth,
  settings,
  debugConfig,
  a11yStatus,
  resolveCanvasConfig,
  runtimeState,
  status,
  layoutPipeline,
  renderer,
  nodeViewManager,
  getEditorPropsList,
}: {
  view: any;
  viewProps: any;
  dom: any;
  basePageWidth: number;
  settings: any;
  debugConfig: any;
  a11yStatus: any;
  resolveCanvasConfig: (key: string, fallback?: any) => any;
  runtimeState: any;
  status: any;
  layoutPipeline: any;
  renderer: any;
  nodeViewManager: any;
  getEditorPropsList: (state?: any) => any[];
}) => {
  renderer.setNodeViewProvider?.(nodeViewManager.getNodeViewForLine);

  const syncNodeViewOverlays = () => {
    nodeViewManager.syncNodeViewOverlays({
      layout: runtimeState.getLayout(),
      layoutIndex: runtimeState.getLayoutIndex(),
      scrollArea: dom.scrollArea,
    });
  };

  const {
    resolvePageWidth,
    getText,
    getTextLength,
    setInputPosition,
  } = createRuntimeHelpers({
    dom,
    basePageWidth,
    settings,
    resolveCanvasConfig,
    queryEditorProp: runtimeState.queryEditorProp,
    getState: () => view.state,
    docToOffsetText,
    getDocTextLength,
  });

  const { getEventCoords, clampOffset, getDocPosFromCoords } = createCoordinateHelpers({
    dom,
    getLayout: runtimeState.getLayout,
    getLayoutIndex: runtimeState.getLayoutIndex,
    getTextLength,
    getState: () => view.state,
    textOffsetToDocPos,
    posAtCoords,
  });

  const { logSelection, debugLog } = createDebugLoggers({
    debugConfig,
    getText,
    docPosToTextOffset,
    clampOffset,
  });

  const decorationResolver = createDecorationResolver({
    viewProps,
    getEditorPropsList,
    getDropDecoration: () => runtimeState.getDragHandlers()?.getDropDecoration?.() ?? null,
    getState: () => view.state,
  });
  runtimeState.setGetDecorations(decorationResolver.getDecorations);

  const { applyViewAttributes } = createViewAttributeApplier({
    dom,
    getEditorPropsList,
    applyDefaultA11y,
  });

  const updateA11yStatus = createA11yStatusUpdater({
    a11yStatus,
    getState: () => view.state,
    getLayoutIndex: runtimeState.getLayoutIndex,
    docPosToTextOffset,
  });

  const renderSync = createRenderSync({
    getEditorState: () => view.state,
    setEditorState: (nextState) => {
      view.state = nextState;
    },
    applyTransaction,
    layoutPipeline,
    renderer,
    spacer: dom.spacer,
    scrollArea: dom.scrollArea,
    status,
    inputEl: dom.input,
    getText,
    getTextLength,
    clampOffset,
    docPosToTextOffset,
    getSelectionOffsets,
    getDecorations: runtimeState.getDecorations,
    selectionToRects,
    buildLayoutIndex,
    coordsAtPos,
    logSelection,
    getCaretOffset: runtimeState.getCaretOffset,
    setCaretOffsetValue: runtimeState.setCaretOffset,
    getCaretRect: runtimeState.getCaretRect,
    setCaretRect: runtimeState.setCaretRect,
    setPreferredX: runtimeState.setPreferredX,
    getPendingPreferredUpdate: runtimeState.getPendingPreferredUpdate,
    setPendingPreferredUpdate: runtimeState.setPendingPreferredUpdate,
    getLayout: runtimeState.getLayout,
    setLayout: runtimeState.setLayout,
    getLayoutIndex: runtimeState.getLayoutIndex,
    setLayoutIndex: runtimeState.setLayoutIndex,
    getRafId: runtimeState.getRafId,
    setRafId: runtimeState.setRafId,
    setInputPosition,
    syncNodeViewOverlays,
    resolvePageWidth,
    queryEditorProp: runtimeState.queryEditorProp,
    scrollIntoViewAtPos: (pos?: number) => {
      scrollViewIntoView(view, pos, docPosToTextOffset, coordsAtPos);
    },
    getPendingChangeSummary: runtimeState.getPendingChangeSummary,
    clearPendingChangeSummary: runtimeState.clearPendingChangeSummary,
    getPendingSteps: runtimeState.getPendingSteps,
    clearPendingSteps: runtimeState.clearPendingSteps,
    paginationTiming: false,
    renderTiming: false,
  });

  return {
    getText,
    getTextLength,
    setInputPosition,
    getEventCoords,
    clampOffset,
    getDocPosFromCoords,
    logSelection,
    debugLog,
    syncNodeViewOverlays,
    applyViewAttributes,
    updateA11yStatus,
    renderSync,
  };
};
