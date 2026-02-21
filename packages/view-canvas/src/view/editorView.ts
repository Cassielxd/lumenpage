import { DOMParser as PMDOMParser } from "lumenpage-model";
import { NodeSelection } from "lumenpage-state";

import {
  applyTransaction,
  docToOffsetText,
  createChangeEvent,
  createSelectionStateAtOffset,
  docPosToTextOffset,
  getSelectionAnchorOffset,
  getSelectionOffsets,
  LayoutPipeline,
  textOffsetToDocPos,
} from "../core";

import { createRenderSync } from "./renderSync";
import { createLayoutWorkerClient } from "./layoutWorkerClient";
import { coordsAtPos, posAtCoords } from "./posIndex";
import { selectionToRects, activeBlockToRects } from "./render/selection";
import { buildLayoutIndex } from "./layoutIndex";

import { Renderer } from "./renderer";
import { applyDefaultA11y } from "./editorView/dom";
import { initEditorViewEnvironment } from "./editorView/bootstrap";
import { createA11yStatusUpdater } from "./editorView/a11y";
import { createCommandRuntime } from "./editorView/commandRuntime";
import { createCoordinateHelpers } from "./editorView/coords";
import { createDecorationResolver } from "./editorView/decorations";
import { bindViewDomEvents, createViewEventHandlers } from "./editorView/events";
import { createInteractionPipeline } from "./editorView/interactions";
import { createEditorInternals } from "./editorView/internals";
import { destroyView } from "./editorView/lifecycle";
import { createEditorPropHandlers } from "./editorView/plugins";
import { createNodeViewManager } from "./editorView/nodeViews";
import { createViewAttributeApplier } from "./editorView/propsState";
import { createParseHtmlToSlice } from "./editorView/parseHtml";
import { createSelectionInteractions } from "./editorView/selectionInteractions";
import { createStateFlow } from "./editorView/stateFlow";
import { createDebugLoggers, createRuntimeHelpers } from "./editorView/runtimeHelpers";
import { createEditorInputPipeline } from "./editorView/inputPipeline";
import { createNodeViewBindings } from "./editorView/nodeViewBindings";
import { createEditingRuntime } from "./editorView/editingRuntime";
import {
  dispatchViewTransaction,
  focusView,
  isEndOfTextblock,
  isViewEditable,
  readSomeProp,
  scrollViewIntoView,
  setViewProps,
  viewCoordsAtPos,
  viewHasFocus,
  viewPosAtCoords,
} from "./editorView/publicApi";
import { createSliceFromText } from "./editorView/text";

export class CanvasEditorView {
  dom;
  state;
  commands;
  _internals;
  overlayHost;
  composing;

  constructor(place, props) {
    const viewProps = props ?? {};
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
      layoutWorkerConfig,
      nodeViewFactories,
      status,
    } = initEditorViewEnvironment({ place, viewProps });
    this.state = editorState;
    this.dom = dom.root;
    this.overlayHost = dom.overlayHost ?? null;

    const layoutWorkerClient = createLayoutWorkerClient({
      settings,
      schema,
      config: layoutWorkerConfig,
    });

    // 甯冨眬涓庢覆鏌撶绾裤€?
    const layoutPipeline = new LayoutPipeline(settings, nodeRegistry);
    const renderer = new Renderer(dom.pageLayer, dom.overlayCanvas, settings, nodeRegistry);

    let layout = null;
    let layoutIndex = null;
    let pendingChangeSummary = null;
    let pendingSteps = null;
    let rafId = 0;
    let caretOffset = 0;
    let caretRect = null;
    let preferredX = null;
    let pendingPreferredUpdate = true;
    let isComposing = false;
    this.composing = false;
    let editorProps = viewProps;
    const onChange = resolveCanvasConfig("onChange", null);
    const { runCommand, basicCommands, runKeymap, enableBuiltInKeyFallback } = createCommandRuntime({
      view: this,
      schema,
      resolveCanvasConfig,
    });

    // NodeView 管理能力由独立模块提供，editorView 只做装配。
    const configuredNodeSelectionTypes = resolveCanvasConfig("nodeSelectionTypes", null);
    // 对齐 PM 且保证可用性：
    // 未显式配置时使用默认判定函数（避免抢占 textblock 光标）。
    // 显式配置 nodeSelectionTypes 时按白名单收窄。
    const defaultNodeSelectionTypes =
      Array.isArray(configuredNodeSelectionTypes) && configuredNodeSelectionTypes.length > 0
        ? new Set(configuredNodeSelectionTypes)
        : null;
    let getDecorations = null;
    let queryEditorProp: (name: string, ...args: any[]) => any = () => null;
    const nodeViewManager = createNodeViewManager({
      view: this,
      getState: () => this.state,
      nodeRegistry,
      nodeViewFactories,
      getNodeViewFactories: () => queryEditorProp("nodeViews") ?? editorProps?.nodeViews ?? null,
      getDecorations: () => getDecorations?.(),
      defaultNodeSelectionTypes,
      logNodeSelection: debugConfig?.selection
        ? (phase, payload) => {
            console.log(`[node-selection:${phase}]`, payload);
          }
        : null,
    });
    renderer.setNodeViewProvider?.(nodeViewManager.getNodeViewForLine);
    const syncNodeViewOverlays = () => {
      nodeViewManager.syncNodeViewOverlays({
        layout,
        layoutIndex,
        scrollArea: dom.scrollArea,
      });
    };
    const {
      resolvePageWidth,
      getText,
      setInputPosition,
      isInSpecialStructureAtPos,
      shouldAutoAdvanceAfterEnter,
    } = createRuntimeHelpers({
      dom,
      basePageWidth,
      resolveCanvasConfig,
      getState: () => this.state,
      docToOffsetText,
    });

    const { getEventCoords, clampOffset, getDocPosFromCoords } = createCoordinateHelpers({
      dom,
      getLayout: () => layout,
      getText,
      getState: () => this.state,
      textOffsetToDocPos,
      posAtCoords,
    });

    const { logSelection, logDelete, debugLog } = createDebugLoggers({
      debugConfig,
      getText,
      docPosToTextOffset,
      clampOffset,
    });


    const editorPropHandlers = createEditorPropHandlers({
      view: this,
      editorProps,
      getEditorProps: () => editorProps,
      getState: () => this.state,
      domRoot: dom.root,
    });

    const {
      getEditorPropsList,
      dispatchEditorProp,
      queryEditorProp: queryEditorPropFromHandlers,
      refreshDomEventHandlers,
      clearDomEventHandlers,
      updatePluginViews,
      destroyPluginViews,
      init: initPluginViews,
    } = editorPropHandlers;
    queryEditorProp = queryEditorPropFromHandlers;

    const { applyViewAttributes } = createViewAttributeApplier({
      dom,
      getEditorPropsList,
      applyDefaultA11y,
    });

    let dragHandlers = null;

    const decorationResolver = createDecorationResolver({
      viewProps,
      getEditorPropsList,
      getDropDecoration: () => dragHandlers?.getDropDecoration?.() ?? null,
      getState: () => this.state,
    });
    getDecorations = decorationResolver.getDecorations;

    const updateA11yStatus = createA11yStatusUpdater({
      a11yStatus,
      getState: () => this.state,
      getLayoutIndex: () => layoutIndex,
      docPosToTextOffset,
    });

    const renderSync = createRenderSync({
      getEditorState: () => this.state,
      setEditorState: (nextState) => {
        this.state = nextState;
      },
      applyTransaction,
      layoutPipeline,
      layoutWorker: layoutWorkerClient,
      renderer,
      spacer: dom.spacer,
      scrollArea: dom.scrollArea,
      status,
      inputEl: dom.input,
      getText,
      clampOffset,
      docPosToTextOffset,
      getSelectionOffsets,
      getDecorations,
      selectionToRects,
      activeBlockToRects,
      buildLayoutIndex,
      blockSelectionConfig: settings.blockSelection,
      coordsAtPos,
      logSelection,
      getCaretOffset: () => caretOffset,
      setCaretOffsetValue: (value) => {
        caretOffset = value;
      },
      getCaretRect: () => caretRect,
      setCaretRect: (value) => {
        caretRect = value;
      },
      setPreferredX: (value) => {
        preferredX = value;
      },
      getPendingPreferredUpdate: () => pendingPreferredUpdate,
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
      getLayout: () => layout,
      setLayout: (value) => {
        layout = value;
      },
      getLayoutIndex: () => layoutIndex,
      setLayoutIndex: (value) => {
        layoutIndex = value;
      },
      getRafId: () => rafId,
      setRafId: (value) => {
        rafId = value;
      },
      setInputPosition,
      syncNodeViewOverlays,
      resolvePageWidth,
      queryEditorProp,
      getPendingChangeSummary: () => pendingChangeSummary,
      clearPendingChangeSummary: () => {
        pendingChangeSummary = null;
      },
      getPendingSteps: () => pendingSteps,
      clearPendingSteps: () => {
        pendingSteps = null;
      },
    });

    const { updateStatus, scheduleRender, updateCaret, updateLayout, syncAfterStateChange } =
      renderSync;

    layoutWorkerClient?.whenReady?.().then(() => {
      if (layoutWorkerClient?.isActive?.()) {
        updateLayout();
      }
    }).catch(() => null);

    const { dispatchTransaction, setSelectionOffsets } = createStateFlow({
      view: this,
      getEditorProps: () => editorProps,
      applyTransaction,
      createChangeEvent,
      layoutPipeline,
      onChange,
      setPendingChangeSummary: (value) => {
        pendingChangeSummary = value;
      },
      setPendingSteps: (value) => {
        pendingSteps = value;
      },
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
      textOffsetToDocPos,
      debugLog,
    });

    const selectionInteractions = createSelectionInteractions({
      getState: () => this.state,
      getLayout: () => layout,
      scrollArea: dom.scrollArea,
      isEditable: () => this.editable,
      textOffsetToDocPos,
      dispatchTransaction,
      queryEditorProp,
      resolveNodeSelectionTargetFromManager: (payload) =>
        nodeViewManager.resolveNodeSelectionTarget(payload),
      setSkipNextClickSelection: (value) => nodeViewManager.setSkipNextClickSelection(value),
    });
    const {
      setSelectionFromHit,
      setNodeSelectionAtPos,
      resolveGapSelectionAtPos,
      resolveNodeSelectionTarget,
      setGapCursorAtCoords,
    } = selectionInteractions;

    const parseHtmlToSlice = createParseHtmlToSlice({
      resolveCanvasConfig,
      schema,
      PMDOMParser,
      queryEditorProp,
      getDomRoot: () => dom.root,
    });

    const {
      setCaretOffset,
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
      getState: () => this.state,
      dispatchTransaction,
      runCommand,
      basicCommands,
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
      getCaretOffset: () => caretOffset,
      getText,
      setSelectionOffsets,
      docPosToTextOffset,
      textOffsetToDocPos,
      createSelectionStateAtOffset,
      logDelete,
      isInSpecialStructureAtPos,
      shouldAutoAdvanceAfterEnter,
      getLayout: () => layout,
      getLayoutIndex: () => layoutIndex,
      getPreferredX: () => preferredX,
      updateCaret,
      scrollArea: dom.scrollArea,
      getSelectionAnchorOffset: () =>
        getSelectionAnchorOffset(this.state, docPosToTextOffset, clampOffset),
    });

    const {
      detachInputBridge,
      resetComposing,
      clipboardTextSerializer,
      serializeSliceToHtmlForClipboard,
    } = createEditorInputPipeline({
      view: this,
      dom,
      getState: () => this.state,
      dispatchEditorProp,
      queryEditorProp,
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
      getCaretOffset: () => caretOffset,
      parseHtmlToSlice,
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
      setComposing: (value) => {
        isComposing = value;
        this.composing = value;
      },
      getIsComposing: () => isComposing,
    });

    const interactionPipeline = createInteractionPipeline({
      view: this,
      settings,
      dom,
      getLayout: () => layout,
      getLayoutIndex: () => layoutIndex,
      getText,
      posAtCoords,
      setSelectionOffsets,
      setSelectionFromHit,
      setNodeSelectionAtPos,
      setGapCursorAtCoords,
      resolveNodeSelectionTarget,
      resolveGapSelectionAtPos,
      getSelectionAnchorOffset: () =>
        getSelectionAnchorOffset(this.state, docPosToTextOffset, clampOffset),
      getSelectionRangeOffsets: () =>
        getSelectionOffsets(this.state, docPosToTextOffset, clampOffset),
      setSkipNextClickSelection: (value) => nodeViewManager.setSkipNextClickSelection(value),
      getState: () => this.state,
      setPreferredX: (value) => {
        preferredX = value;
      },
      textOffsetToDocPos,
      getEventCoords,
      getDocPosFromCoords,
      serializeSliceToHtmlForClipboard,
      clipboardTextSerializer,
      createSliceFromText,
      parseHtmlToSlice,
      dispatchEditorProp,
      queryEditorProp,
      dispatchTransaction,
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
      scheduleRender,
    });
    dragHandlers = interactionPipeline.dragHandlers;
    const { handlePointerDown, handlePointerMove, handlePointerUp } =
      interactionPipeline.pointerHandlers;
    const { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } =
      interactionPipeline.touchHandlers;
    const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } =
      interactionPipeline.domDragHandlers;

    const { syncNodeViews, destroyNodeViews, handleNodeViewClick } = createNodeViewBindings({
      nodeViewManager,
      getEventCoords,
      getDocPosFromCoords,
      docPosToTextOffset,
      getLayoutIndex: () => layoutIndex,
      queryEditorProp,
      dispatchTransaction,
    });

    const eventHandlers = createViewEventHandlers({
      getState: () => this.state,
      hasFocus: () => this.hasFocus(),
      getEventCoords,
      getDocPosFromCoords,
      dispatchEditorProp,
      handleNodeViewClick,
      consumeSkipNextClickSelection: () => nodeViewManager.consumeSkipNextClickSelection(),
      focusInput: () => {
        dom.input.focus();
      },
      debugLog,
      updateStatus,
      updateCaret,
      scheduleRender,
    });
    const {
      onClickFocus,
      onDoubleClick,
      onRootFocus,
      onDocumentSelectionChange,
      onScroll,
      onResize,
    } = eventHandlers;

    bindViewDomEvents({
      dom,
      updateStatus,
      resetComposing,
      handlers: eventHandlers,
      pointerHandlers: { handlePointerDown, handlePointerMove, handlePointerUp },
      touchHandlers: { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel },
      dragHandlers: { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd },
    });

    initPluginViews();
    applyViewAttributes(this.state);

    // 鍒濆甯冨眬涓庢覆鏌撱€?
    updateLayout();
    syncNodeViews();
    syncAfterStateChange();
    updateA11yStatus();

    this._internals = createEditorInternals({
      dom,
      settings,
      renderer,
      onChange,
      layoutPipeline,
      layoutWorker: layoutWorkerClient,
      renderSync,
      getText,
      getLayout: () => layout,
      getLayoutIndex: () => layoutIndex,
      getRafId: () => rafId,
      getEditorProps: () => editorProps,
      setEditorProps: (value) => {
        editorProps = value ?? {};
      },
      setPendingChangeSummary: (value) => {
        pendingChangeSummary = value;
      },
      dispatchTransaction,
      updateLayout,
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
      detachInputBridge,
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
      refreshDomEventHandlers,
      getEditorPropsList,
      queryEditorProp,
      applyViewAttributes,
    });
  }

  // 澶栭儴鏇存柊 state 鏃惰皟鐢ㄣ€?
  updateState(state) {
    const prev = this.state;
    this.state = state;

    this._internals.updatePluginViews?.(prev, state);

    if (prev?.doc !== state?.doc) {
      this._internals.updateLayout();
    }
    this._internals.syncNodeViews?.();
    this._internals.syncAfterStateChange();
    this._internals.updateA11yStatus?.();
    this._internals.applyViewAttributes?.(state);
  }

  setProps(props: Record<string, any> = {}) {
    setViewProps(this, props);
  }

  // 鐩存帴娲惧彂 Transaction銆?
  dispatch(tr) {
    dispatchViewTransaction(this, tr);
  }

  someProp(propName: string, f?: (value: any) => any) {
    return readSomeProp(this, propName, f);
  }

  // 鍒ゆ柇鍏夋爣鏄惁鍒拌揪鏂囨湰鍧楄竟鐣屻€?

  endOfTextblock(dir = "forward", state = undefined) {
    return isEndOfTextblock(this, dir, state);
  }

  // 鏂囨。浣嶇疆 -> 瑙嗗彛鍧愭爣銆?
  coordsAtPos(pos) {
    return viewCoordsAtPos(this, pos, docPosToTextOffset, coordsAtPos);
  }

  // 瑙嗗彛鍧愭爣 -> 鏂囨。浣嶇疆銆?
  posAtCoords(coords) {
    return viewPosAtCoords(this, coords, textOffsetToDocPos, posAtCoords, NodeSelection);
  }

  // 灏嗘寚瀹氫綅缃粴鍔ㄥ埌鍙鍖哄煙銆?
  scrollIntoView(pos?: number) {
    scrollViewIntoView(this, pos, docPosToTextOffset, coordsAtPos);
  }

  // 鑱氱劍杈撳叆灞傘€?
  focus() {
    focusView(this);
  }

  hasFocus() {
    return viewHasFocus(this);
  }

  get editable() {
    return isViewEditable(this);
  }

  // 绉婚櫎浜嬩欢鐩戝惉涓?DOM銆?
  destroy() {
    destroyView(this);
  }
}
























