import {
  applyTransaction,
  createChangeEvent,
  docPosToTextOffset,
  docToOffsetText,
  getDocTextLength,
  getSelectionOffsets,
  LayoutPipeline,
  textOffsetToDocPos,
} from "../../core";
import { buildLayoutIndex } from "../layoutIndex";
import { coordsAtPos, posAtCoords } from "../posIndex";
import { selectionToRects } from "../render/selection";
import { createRenderSync } from "../renderSync";
import { Renderer } from "../renderer";
import { createA11yStatusUpdater } from "./a11y";
import { initEditorViewEnvironment } from "./bootstrap";
import { createCoordinateHelpers } from "./coords";
import { createDecorationResolver } from "./decorations";
import { applyDefaultA11y } from "./dom";
import { bindViewDomEvents } from "./events";
import { createEditorInternals } from "./internals";
import { warnLegacyCanvasConfigUsage } from "./legacyConfigWarnings";
import { createNodeViewManager } from "./nodeViews";
import { createEditorPropHandlers } from "./plugins";
import { createViewAttributeApplier } from "./propsState";
import { scrollViewIntoView } from "./publicApi";
import { createEditorViewRuntimeState } from "./runtimeState";
import { createEditorViewInteractionRuntime } from "./setupInteractionRuntime";
import { createStateFlow } from "./stateFlow";
import { createDebugLoggers, createRuntimeHelpers } from "./runtimeHelpers";
import type { CanvasEditorViewProps } from "./types";

export type CanvasEditorViewSetupResult = {
  state: any;
  domRoot: any;
  overlayHost: any;
  dispatchTransaction: (tr: any) => void;
  internals: any;
  composing: boolean;
};

export const setupCanvasEditorView = ({
  view,
  place,
  props,
}: {
  view: any;
  place: any;
  props?: CanvasEditorViewProps;
}): CanvasEditorViewSetupResult => {
  const viewProps: CanvasEditorViewProps = props ?? ({} as CanvasEditorViewProps);
  const {
    editorState,
    debugConfig,
    dom,
    settings,
    basePageWidth,
    schema,
    a11yStatus,
    resolveCanvasConfig,
    nodeRegistry,
    status,
  } = initEditorViewEnvironment({ place, viewProps });
  view.state = editorState;
  view.dom = dom.root;
  view.overlayHost = dom.overlayHost ?? null;
  view.composing = false;

  const runtimeState = createEditorViewRuntimeState(viewProps);
  const layoutPipeline = new LayoutPipeline(settings, nodeRegistry);
  const renderer = new Renderer(dom.pageLayer, dom.overlayCanvas, settings, nodeRegistry);

  const setPendingChangeSummaryValue = (value: any) => {
    const next =
      value && typeof value === "object" ? value : value == null ? null : { docChanged: false };
    const current = runtimeState.getPendingChangeSummary();
    if (current?.docChanged === true) {
      if (next?.docChanged === true) {
        runtimeState.setPendingChangeSummary({ docChanged: true });
      }
      return;
    }
    runtimeState.setPendingChangeSummary(next);
  };

  const onChange = resolveCanvasConfig("onChange", null);
  const strictLegacy = resolveCanvasConfig("legacyPolicy", null)?.strict === true;

  const configuredNodeSelectionTypes = resolveCanvasConfig("nodeSelectionTypes", null);
  const getDefaultNodeSelectionTypes = () => {
    const fromProps = runtimeState.queryEditorProp("nodeSelectionTypes");
    const resolved =
      Array.isArray(fromProps) && fromProps.length > 0
        ? fromProps
        : Array.isArray(configuredNodeSelectionTypes) && configuredNodeSelectionTypes.length > 0
          ? configuredNodeSelectionTypes
          : null;
    if (!Array.isArray(fromProps) && Array.isArray(configuredNodeSelectionTypes) && resolved) {
      warnLegacyCanvasConfigUsage(
        "nodeSelectionTypes",
        "EditorProps.nodeSelectionTypes",
        strictLegacy
      );
    }
    return resolved ? new Set(resolved) : null;
  };

  const nodeViewManager = createNodeViewManager({
    view,
    getState: () => view.state,
    getPendingChangeSummary: runtimeState.getPendingChangeSummary,
    nodeRegistry,
    getNodeViewFactories: () => runtimeState.queryEditorProp("nodeViews") ?? null,
    getDecorations: () => runtimeState.getDecorations(),
    getDefaultNodeSelectionTypes,
    logNodeSelection: null,
  });
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

  const editorPropHandlers = createEditorPropHandlers({
    view,
    editorProps: runtimeState.getEditorProps(),
    getEditorProps: runtimeState.getEditorProps,
    getState: () => view.state,
    domRoot: dom.root,
  });
  const {
    getEditorPropsList,
    dispatchEditorProp,
    queryEditorProp,
    refreshDomEventHandlers,
    clearDomEventHandlers,
    updatePluginViews,
    destroyPluginViews,
    init: initPluginViews,
  } = editorPropHandlers;
  runtimeState.setQueryEditorProp(queryEditorProp);

  const { applyViewAttributes } = createViewAttributeApplier({
    dom,
    getEditorPropsList,
    applyDefaultA11y,
  });

  const decorationResolver = createDecorationResolver({
    viewProps,
    getEditorPropsList,
    getDropDecoration: () => runtimeState.getDragHandlers()?.getDropDecoration?.() ?? null,
    getState: () => view.state,
  });
  runtimeState.setGetDecorations(decorationResolver.getDecorations);

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
  const {
    updateStatus,
    scheduleRender,
    scheduleLayout,
    updateCaret,
    updateLayout,
    syncAfterStateChange,
  } = renderSync;

  const {
    dispatchTransaction: applyDispatchTransaction,
    dispatchTransactionBase,
    setSelectionOffsets,
  } = createStateFlow({
    view,
    getEditorProps: runtimeState.getEditorProps,
    getEditorPropsList,
    applyTransaction,
    createChangeEvent,
    onBeforeTransaction: (args) => {
      runtimeState.queryEditorProp("onBeforeTransaction", args);
    },
    layoutPipeline,
    onChange,
    setPendingChangeSummary: setPendingChangeSummaryValue,
    setPendingSteps: runtimeState.setPendingSteps,
    setPendingPreferredUpdate: runtimeState.setPendingPreferredUpdate,
    textOffsetToDocPos,
    debugLog,
    strictLegacy,
  });
  const dispatchViaView = (tr: any) => view.dispatch(tr);

  const {
    setNodeSelectionAtPos,
    detachInputBridge,
    resetComposing,
    debugInputHandlers,
    syncNodeViews,
    destroyNodeViews,
    pointerHandlers,
    touchHandlers,
    domDragHandlers,
    eventHandlers,
  } = createEditorViewInteractionRuntime({
    view,
    dom,
    settings,
    schema,
    resolveCanvasConfig,
    nodeViewManager,
    runtimeState,
    getDefaultNodeSelectionTypes,
    getEventCoords,
    getDocPosFromCoords,
    getText,
    getTextLength,
    setSelectionOffsets,
    dispatchEditorProp,
    dispatchTransaction: dispatchViaView,
    textOffsetToDocPos,
    docPosToTextOffset,
    clampOffset,
    updateStatus,
    updateCaret,
    scheduleRender,
    debugLog,
  });
  const { handlePointerDown, handlePointerMove, handlePointerUp } = pointerHandlers;
  const { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } = touchHandlers;
  const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } =
    domDragHandlers;
  const {
    onClickFocus,
    onDoubleClick,
    onRootFocus,
    onDocumentSelectionChange,
    onScroll,
    onResize,
  } = eventHandlers;
  let unbindDomEvents = () => {};

  const internals = createEditorInternals({
    core: {
      dom,
      settings,
      renderer,
      onChange,
      layoutPipeline,
      renderSync,
    },
    stateAccessors: {
      getText,
      getTextLength,
      getLayout: runtimeState.getLayout,
      getLayoutIndex: runtimeState.getLayoutIndex,
      getRafId: runtimeState.getRafId,
      getCaretOffset: runtimeState.getCaretOffset,
      getCaretRect: runtimeState.getCaretRect,
      getEditorProps: runtimeState.getEditorProps,
      setEditorProps: runtimeState.setEditorProps,
      setPendingChangeSummary: setPendingChangeSummaryValue,
    },
    interactionRuntime: {
      dispatchTransaction: dispatchViaView,
      dispatchTransactionBase,
      setNodeSelectionAtPos,
    },
    viewSync: {
      updateLayout,
      scheduleLayout,
      updatePluginViews,
      syncNodeViews,
      destroyNodeViews,
      destroyPluginViews,
      clearDomEventHandlers,
      updateA11yStatus,
      scheduleRender,
      updateCaret,
      setInputPosition,
      syncNodeViewOverlays,
      syncAfterStateChange,
      refreshDomEventHandlers,
      getEditorPropsList,
      queryEditorProp: runtimeState.queryEditorProp,
      applyViewAttributes,
    },
    domEvents: {
      detachInputBridge,
      unbindDomEvents: () => {
        unbindDomEvents?.();
      },
      onScroll,
      onResize,
      onClickFocus,
      onDoubleClick,
      onRootFocus,
      onDocumentSelectionChange,
      resetComposing,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleTouchCancel,
      handleDragStart,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleDragEnd,
      dragHandlers: runtimeState.getDragHandlers(),
      inputDebugHandlers: debugInputHandlers,
    },
  });

  view.dispatchTransaction = applyDispatchTransaction;
  view._internals = internals;
  view.composing = runtimeState.getIsComposing();

  unbindDomEvents = bindViewDomEvents({
    dom,
    updateStatus,
    resetComposing,
    handlers: eventHandlers,
    pointerHandlers: { handlePointerDown, handlePointerMove, handlePointerUp },
    touchHandlers: { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel },
    dragHandlers: { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd },
  });

  initPluginViews();
  applyViewAttributes(view.state);
  updateLayout();
  syncNodeViews(null);
  syncAfterStateChange();
  updateA11yStatus();

  return {
    state: view.state,
    domRoot: view.dom,
    overlayHost: view.overlayHost,
    dispatchTransaction: applyDispatchTransaction,
    internals,
    composing: view.composing,
  };
};
