import { DOMParser as PMDOMParser } from "lumenpage-model";
import { createSelectionStateAtOffset, getSelectionAnchorOffset, getSelectionOffsets } from "../../core";
import { posAtCoords } from "../posIndex";
import { createEditingRuntime } from "./editingRuntime";
import { createEditorInputPipeline } from "./inputPipeline";
import { createInteractionPipeline } from "./interactions";
import { createNodeViewBindings } from "./nodeViewBindings";
import { createParseHtmlToSlice } from "./parseHtml";
import { createSelectionInteractions } from "./selectionInteractions";
import { createViewEventHandlers } from "./events";
import { createSliceFromText } from "./text";

export const createEditorViewInteractionRuntime = ({
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
  runCommand,
  basicCommands,
  runKeymap,
  enableBuiltInKeyFallback,
  dispatchTransaction,
  textOffsetToDocPos,
  docPosToTextOffset,
  clampOffset,
  logDelete,
  isInSpecialStructureAtPos,
  shouldAutoAdvanceAfterEnter,
  updateStatus,
  updateCaret,
  scheduleRender,
  debugLog,
}: {
  view: any;
  dom: any;
  settings: any;
  schema: any;
  resolveCanvasConfig: (key: string, fallback?: any) => any;
  nodeViewManager: any;
  runtimeState: any;
  getDefaultNodeSelectionTypes: () => Set<string> | null;
  getEventCoords: (event: any) => any;
  getDocPosFromCoords: (coords: any) => any;
  getText: () => string;
  getTextLength: () => number;
  setSelectionOffsets: (anchor: number, head: number, options?: any) => void;
  dispatchEditorProp: (name: any, ...args: any[]) => boolean;
  runCommand: any;
  basicCommands: any;
  runKeymap: any;
  enableBuiltInKeyFallback: boolean;
  dispatchTransaction: (tr: any) => void;
  textOffsetToDocPos: (doc: any, offset: number) => number;
  docPosToTextOffset: (doc: any, pos: number) => number;
  clampOffset: (offset: number) => number;
  logDelete: (...args: any[]) => void;
  isInSpecialStructureAtPos: (state: any, pos: number) => boolean;
  shouldAutoAdvanceAfterEnter: (args: any) => boolean | null;
  updateStatus: () => void;
  updateCaret: (updatePreferred: boolean) => void;
  scheduleRender: () => void;
  debugLog: (...args: any[]) => void;
}) => {
  const { setSelectionFromHit, setNodeSelectionAtPos } = createSelectionInteractions({
    getState: () => view.state,
    textOffsetToDocPos,
    dispatchTransaction,
    queryEditorProp: runtimeState.queryEditorProp,
    getDefaultNodeSelectionTypes,
    resolveNodeSelectionTargetFromManager: (payload) =>
      nodeViewManager.resolveNodeSelectionTarget(payload),
    setSkipNextClickSelection: (value) => nodeViewManager.setSkipNextClickSelection(value),
  });

  const parseHtmlToSlice = createParseHtmlToSlice({
    resolveCanvasConfig,
    schema,
    PMDOMParser,
    queryEditorProp: runtimeState.queryEditorProp,
    getDomRoot: () => dom.root,
  });

  const {
    insertText,
    insertTextWithBreaks,
    deleteText,
    computeLineEdgeOffset,
    computeVerticalOffset,
    moveHorizontal,
    moveLineEdge,
    moveVertical,
    extendSelection,
  } = createEditingRuntime({
    getState: () => view.state,
    dispatchTransaction,
    runCommand,
    basicCommands,
    setPendingPreferredUpdate: runtimeState.setPendingPreferredUpdate,
    getCaretOffset: runtimeState.getCaretOffset,
    getText,
    getTextLength,
    setSelectionOffsets,
    docPosToTextOffset,
    textOffsetToDocPos,
    createSelectionStateAtOffset,
    logDelete,
    isInSpecialStructureAtPos,
    shouldAutoAdvanceAfterEnter,
    getLayout: runtimeState.getLayout,
    getLayoutIndex: runtimeState.getLayoutIndex,
    getPreferredX: runtimeState.getPreferredX,
    updateCaret,
    scrollArea: dom.scrollArea,
    getSelectionAnchorOffset: () =>
      getSelectionAnchorOffset(view.state, docPosToTextOffset, clampOffset),
  });

  const {
    detachInputBridge,
    resetComposing,
    clipboardTextSerializer,
    serializeSliceToHtmlForClipboard,
    debugInputHandlers,
  } = createEditorInputPipeline({
    view,
    dom,
    getState: () => view.state,
    dispatchEditorProp,
    queryEditorProp: runtimeState.queryEditorProp,
    dispatchTransaction,
    runCommand,
    basicCommands,
    runKeymap,
    enableBuiltInKeyFallback,
    insertText,
    insertTextWithBreaks,
    deleteText,
    computeLineEdgeOffset,
    computeVerticalOffset,
    moveHorizontal,
    moveVertical,
    moveLineEdge,
    extendSelection,
    clampOffset,
    getCaretOffset: runtimeState.getCaretOffset,
    parseHtmlToSlice,
    setPendingPreferredUpdate: runtimeState.setPendingPreferredUpdate,
    setComposing: (value) => {
      runtimeState.setIsComposing(value);
      view.composing = value === true;
    },
    getIsComposing: runtimeState.getIsComposing,
  });

  const interactionPipeline = createInteractionPipeline({
    view,
    settings,
    dom,
    getLayout: runtimeState.getLayout,
    getLayoutIndex: runtimeState.getLayoutIndex,
    getText,
    getTextLength,
    posAtCoords,
    setSelectionOffsets,
    setSelectionFromHit,
    setNodeSelectionAtPos,
    getSelectionAnchorOffset: () =>
      getSelectionAnchorOffset(view.state, docPosToTextOffset, clampOffset),
    getSelectionRangeOffsets: () =>
      getSelectionOffsets(view.state, docPosToTextOffset, clampOffset),
    setSkipNextClickSelection: (value) => nodeViewManager.setSkipNextClickSelection(value),
    getState: () => view.state,
    setPreferredX: runtimeState.setPreferredX,
    getEventCoords,
    getDocPosFromCoords,
    serializeSliceToHtmlForClipboard,
    clipboardTextSerializer,
    createSliceFromText,
    parseHtmlToSlice,
    dispatchEditorProp,
    queryEditorProp: runtimeState.queryEditorProp,
    dispatchTransaction,
    setPendingPreferredUpdate: runtimeState.setPendingPreferredUpdate,
    scheduleRender,
  });
  runtimeState.setDragHandlers(interactionPipeline.dragHandlers);

  const { syncNodeViews, destroyNodeViews, handleNodeViewClick } = createNodeViewBindings({
    manager: {
      nodeViewManager,
    },
    eventResolution: {
      getEventCoords,
      getDocPosFromCoords,
    },
    runtime: {
      docPosToTextOffset,
      getLayoutIndex: runtimeState.getLayoutIndex,
      getChangeSummary: runtimeState.getPendingChangeSummary,
      queryEditorProp: runtimeState.queryEditorProp,
      dispatchTransaction,
    },
  });

  const eventHandlers = createViewEventHandlers({
    getState: () => view.state,
    hasFocus: () => view.hasFocus(),
    getEventCoords,
    getDocPosFromCoords,
    dispatchEditorProp,
    handleNodeViewClick,
    consumeSkipNextClickSelection: () => nodeViewManager.consumeSkipNextClickSelection(),
    focusInput: () => {
      try {
        dom.input.focus({ preventScroll: true });
      } catch (_error) {
        dom.input.focus();
      }
    },
    debugLog,
    updateStatus,
    updateCaret,
    scheduleRender,
    shouldDeferVisualSync: () => runtimeState.getPendingChangeSummary()?.docChanged === true,
    syncNodeViewOverlays: () => {
      const layout = runtimeState.getLayout();
      const layoutIndex = runtimeState.getLayoutIndex();
      if (!layout || !layoutIndex) {
        return;
      }
      nodeViewManager.syncNodeViewOverlays({
        layout,
        layoutIndex,
        scrollArea: dom.scrollArea,
      });
    },
    eventTiming: false,
  });

  return {
    setNodeSelectionAtPos,
    detachInputBridge,
    resetComposing,
    debugInputHandlers,
    syncNodeViews,
    destroyNodeViews,
    pointerHandlers: interactionPipeline.pointerHandlers,
    touchHandlers: interactionPipeline.touchHandlers,
    domDragHandlers: interactionPipeline.domDragHandlers,
    eventHandlers,
  };
};

