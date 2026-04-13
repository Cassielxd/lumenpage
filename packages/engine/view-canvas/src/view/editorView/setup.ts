import { applyTransaction, createChangeEvent, docPosToTextOffset, LayoutPipeline, textOffsetToDocPos } from "../../core/index.js";
import { Renderer } from "../renderer.js";
import { initEditorViewEnvironment } from "./bootstrap.js";
import { bindViewDomEvents } from "./events.js";
import { createEditorInternals } from "./internals.js";
import { warnLegacyCanvasConfigUsage } from "./legacyConfigWarnings.js";
import { createNodeViewManager } from "./nodeViews.js";
import { createEditorPropHandlers } from "./plugins.js";
import { createEditorViewRuntimeState } from "./runtimeState.js";
import { createEditorViewInteractionRuntime } from "./setupInteractionRuntime.js";
import { createEditorViewSyncRuntime } from "./setupViewSyncRuntime.js";
import { createStateFlow } from "./stateFlow.js";
import type { CanvasEditorViewProps } from "./types.js";

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

  const {
    getText,
    getTextLength,
    setInputPosition,
    getEventCoords,
    clampOffset,
    getDocPosFromCoords,
    debugLog,
    syncNodeViewOverlays,
    applyViewAttributes,
    updateA11yStatus,
    renderSync,
  } = createEditorViewSyncRuntime({
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
  });
  const {
    updateStatus,
    scheduleRender,
    scheduleLayout,
    updateCaret,
    updateLayout,
    handleDecorationClick,
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
    handleDecorationClick,
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
