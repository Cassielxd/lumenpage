import { DOMParser as PMDOMParser } from "lumenpage-model";
import { NodeSelection, TextSelection } from "lumenpage-state";

import {
  applyTransaction,
  docToOffsetText,
  createChangeEvent,
  createEditorOps,
  createSelectionLogger,
  createSelectionStateAtOffset,
  docPosToTextOffset,
  getSelectionAnchorOffset,
  getSelectionOffsets,
  LayoutPipeline,
  textOffsetToDocPos,
} from "../core";

import { attachInputBridge } from "./input/bridge";
import { createInputHandlers } from "./input/handlers";
import { createClipboardHandlers } from "./input/clipboard";
import { createPointerHandlers } from "./input/pointerHandlers";
import { createTouchHandlers } from "./input/touchHandlers";
import { createHtmlParser } from "./htmlParser";
import { createRenderSync } from "./renderSync";
import { createSelectionMovement } from "./selectionMovement";
import { coordsAtPos, posAtCoords } from "./posIndex";
import { selectionToRects, activeBlockToRects } from "./render/selection";
import { buildLayoutIndex, getLineAtOffset } from "./layoutIndex";

import { Renderer } from "./renderer";
import {
  DEFAULT_SETTINGS,
  applyDefaultA11y,
  applyDefaultStyles,
  createA11yStatusElement,
  createDefaultDom,
} from "./editorView/dom";
import { createA11yStatusUpdater } from "./editorView/a11y";
import { createDecorationResolver } from "./editorView/decorations";
import { createDragHandlers } from "./editorView/drag";
import { createEditorPropHandlers } from "./editorView/plugins";
import { createSliceFromText, serializeSliceToHtml } from "./editorView/text";
import { getCanvasConfig } from "./canvasConfig";

export class CanvasEditorView {
  dom;
  state;
  _internals;
  overlayHost;

  constructor(place, props) {
    const viewProps = props ?? {};
    const editorState = viewProps.state;
    if (!editorState) {
      throw new Error("CanvasEditorView requires a state, matching ProseMirror EditorView.");
    }
    this.state = editorState;

    const canvasConfig = getCanvasConfig(editorState) ?? {};
    const resolveCanvasConfig = (key, fallback = undefined) =>
      canvasConfig?.[key] ?? fallback;

    // 初始化 DOM，样式与无障碍。
    const dom = resolveCanvasConfig("elements") ?? createDefaultDom();
    const settings = { ...DEFAULT_SETTINGS, ...(resolveCanvasConfig("settings") || {}) };
    const applyStyles = resolveCanvasConfig("applyDefaultStyles", true);

    if (applyStyles) {
      applyDefaultStyles(dom, settings);
    }

    const attributes =
      typeof viewProps.attributes === "function"
        ? viewProps.attributes(editorState)
        : viewProps.attributes;
    applyDefaultA11y(dom, attributes);

    const schema = editorState.schema;
    const a11yStatus = createA11yStatusElement(dom.root);

    if (typeof place === "function") {
      place(dom.root);
    } else {
      const mountTarget = place?.mount ?? place;
      if (mountTarget) {
        mountTarget.appendChild(dom.root);
      }
    }

    this.dom = dom.root;
    this.overlayHost = dom.overlayHost ?? null;

    const nodeRegistry = resolveCanvasConfig("nodeRegistry") ?? null;
    const nodeViewFactories = viewProps.nodeViews ?? null;
    const status = resolveCanvasConfig("statusElement") ?? document.createElement("div");

    // 布局与渲染管线。
    const layoutPipeline = new LayoutPipeline(settings, nodeRegistry);
    const renderer = new Renderer(dom.pageLayer, dom.overlayCanvas, settings, nodeRegistry);

    let layout = null;
    let layoutIndex = null;
    let pendingChangeSummary = null;
    let rafId = 0;
    let caretOffset = 0;
    let caretRect = null;
    let preferredX = null;
    let pendingPreferredUpdate = true;
    let isComposing = false;
    const editorProps = viewProps;
    const commandConfig = resolveCanvasConfig("commands", {});
    const onChange = resolveCanvasConfig("onChange", null);
    const noopCommand = () => false;
    const runCommand =
      commandConfig.runCommand ??
      ((command, state, dispatch) => (typeof command === "function" ? command(state, dispatch) : false));
    const basicCommands = {
      deleteSelection: commandConfig.basicCommands?.deleteSelection ?? noopCommand,
      joinBackward: commandConfig.basicCommands?.joinBackward ?? noopCommand,
      joinForward: commandConfig.basicCommands?.joinForward ?? noopCommand,
      splitBlock: commandConfig.basicCommands?.splitBlock ?? noopCommand,
      undo: commandConfig.basicCommands?.undo ?? noopCommand,
      redo: commandConfig.basicCommands?.redo ?? noopCommand,
    };
    const setBlockAlign = commandConfig.setBlockAlign ?? (() => noopCommand);

    // NodeView 管理。
    const nodeViews = new Map();
    const nodeViewsByBlockId = new Map();
    let selectedNodeViewKey = null;
    let lastNodeViewDecorations = null;

    const getNodeViewKey = (node, pos) => {
      const id = node?.attrs?.id;
      if (id) {
        return `${node.type.name}:${id}`;
      }
      return `${node.type.name}:${pos}`;
    };

    const getNodeViewForLine = (line) => {
      const blockId = line?.blockId;
      if (blockId && nodeViewsByBlockId.has(blockId)) {
        return nodeViewsByBlockId.get(blockId).view;
      }
      return null;
    };

    renderer.setNodeViewProvider?.(getNodeViewForLine);

    const syncNodeViewOverlays = () => {
      if (!layout || !layoutIndex || nodeViewsByBlockId.size === 0) {
        return;
      }
      const lineItems = layoutIndex.lines || [];
      if (lineItems.length === 0) {
        return;
      }
      const scrollTop = dom.scrollArea.scrollTop;
      const viewportWidth = dom.scrollArea.clientWidth;
      const viewportHeight = dom.scrollArea.clientHeight;
      const pageSpan = layout.pageHeight + layout.pageGap;
      const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);

      const firstLineByBlockId = new Map();
      for (const item of lineItems) {
        const blockId = item.line?.blockId;
        if (!blockId || firstLineByBlockId.has(blockId)) {
          continue;
        }
        firstLineByBlockId.set(blockId, item);
      }

      for (const [blockId, entry] of nodeViewsByBlockId) {
        const item = firstLineByBlockId.get(blockId);
        if (!item) {
          entry.view?.syncDOM?.({ visible: false });
          continue;
        }
        const line = item.line;
        const pageTop = item.pageIndex * pageSpan - scrollTop;
        const x = pageX + (line.x ?? 0);
        const y = pageTop + (line.y ?? 0);
        const width = Number.isFinite(line.width)
          ? line.width
          : layout.pageWidth - layout.margin.left - layout.margin.right;
        const height = Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;
        const visible = y + height > 0 && y < viewportHeight;
        entry.view?.syncDOM?.({ x, y, width, height, visible, line, pageIndex: item.pageIndex, layout });
      }
    };


    // 文本/坐标辅助。
    const getText = () => {
      const getTextProp = resolveCanvasConfig("getText");
      if (getTextProp) {
        return getTextProp(this.state.doc);
      }
      if (!this.state?.doc) {
        return "";
      }
      return docToOffsetText(this.state.doc);
    };

    const setInputPosition = (x, y) => {
      dom.input.style.left = `${x}px`;
      dom.input.style.top = `${y}px`;
    };

    const clampOffset = (offset) => {
      const length = getText().length;
      return Math.max(0, Math.min(offset, length));
    };

    const getEventCoords = (event) => {
      const rect = dom.scrollArea.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const getDocPosFromCoords = (coords) => {
      if (!layout) {
        return null;
      }
      const offset = posAtCoords(
        layout,
        coords.x,
        coords.y,
        dom.scrollArea.scrollTop,
        dom.scrollArea.clientWidth,
        getText().length
      );
      if (offset == null) {
        return null;
      }
      return textOffsetToDocPos(this.state.doc, offset);
    };

    const getNodeViewAtCoords = (coords) => {
      if (!layoutIndex) {
        return null;
      }
      const pos = getDocPosFromCoords(coords);
      if (!Number.isFinite(pos)) {
        return null;
      }
      const offset = docPosToTextOffset(this.state.doc, pos);
      const lineItem = getLineAtOffset(layoutIndex, offset);
      const blockId = lineItem?.line?.blockId;
      if (!blockId) {
        return null;
      }
      return nodeViewsByBlockId.get(blockId)?.view ?? null;
    };

    const debugConfig = resolveCanvasConfig("debug", {});
    const logSelection = debugConfig?.selection
      ? createSelectionLogger({ getText, docPosToTextOffset, clampOffset })
      : () => {};
    const logDelete = debugConfig?.delete
      ? (phase, payload) => {
          console.log("[delete]", phase, payload);
        }
      : () => {};


    const editorPropHandlers = createEditorPropHandlers({
      view: this,
      editorProps,
      getState: () => this.state,
      domRoot: dom.root,
    });

    const {
      getEditorPropsList,
      dispatchEditorProp,
      refreshDomEventHandlers,
      clearDomEventHandlers,
      updatePluginViews,
      destroyPluginViews,
      init: initPluginViews,
    } = editorPropHandlers;

    let dragHandlers = null;

    const collaborationConfig = resolveCanvasConfig("collaboration") ?? null;
    const remoteSelections = resolveCanvasConfig("remoteSelections") ?? null;

    const { getDecorations } = createDecorationResolver({
      viewProps,
      collaborationConfig,
      remoteSelections,
      settings,
      getEditorPropsList,
      getDropDecoration: () => dragHandlers?.getDropDecoration?.() ?? null,
      getState: () => this.state,
    });

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
      getPendingChangeSummary: () => pendingChangeSummary,
      clearPendingChangeSummary: () => {
        pendingChangeSummary = null;
      },
    });

    const { updateStatus, scheduleRender, updateCaret, updateLayout, syncAfterStateChange } =
      renderSync;

    // 统一派发 Transaction 的入口。
    const dispatchTransaction = (tr) => {
      if (viewProps?.dispatchTransaction) {
        viewProps.dispatchTransaction(tr);
        return;
      }
      const prevState = this.state;
      const nextState = applyTransaction(prevState, tr);
      const shouldScroll = tr?.scrolledIntoView;
      const changeEvent = createChangeEvent(tr, prevState, nextState);
      if (changeEvent?.summary?.blocks?.ids?.length) {
        layoutPipeline.invalidateBlocks(changeEvent.summary.blocks.ids);
      }
      if (onChange) {
        onChange(changeEvent);
      }
      pendingChangeSummary = changeEvent.summary || null;
      this.updateState(nextState);
      if (shouldScroll) {
        this.scrollIntoView();
      }
    };

    const setSelectionOffsets = (anchorOffset, headOffset, updatePreferred) => {
      if (!Number.isFinite(anchorOffset) || !Number.isFinite(headOffset)) {
        return;
      }

      pendingPreferredUpdate = updatePreferred;

      const anchorPos = textOffsetToDocPos(this.state.doc, anchorOffset);
      const headPos = textOffsetToDocPos(this.state.doc, headOffset);
      if (!Number.isFinite(anchorPos) || !Number.isFinite(headPos)) {
        return;
      }

      const tr = this.state.tr.setSelection(
        TextSelection.create(this.state.doc, anchorPos, headPos)
      );
      dispatchTransaction(tr);
    };

    // 文本编辑操作集合。
    const { setCaretOffset, insertText, insertTextWithBreaks, deleteSelectionIfNeeded, deleteText } =
      createEditorOps({
        getEditorState: () => this.state,
        dispatchTransaction,
        runCommand,
        basicCommands,
        pendingPreferredUpdateRef: {
          set: (value) => {
            pendingPreferredUpdate = value;
          },
        },
        getCaretOffset: () => caretOffset,
        getText,
        setSelectionOffsets,
        textOffsetToDocPos,
        createSelectionStateAtOffset,
        logDelete,
      });

    // HTML 解析器（粘贴/拖拽时使用）。
    const parseHtmlToSlice =
      resolveCanvasConfig("parseHtmlToSlice") ??
      (schema
        ? createHtmlParser(schema, PMDOMParser)
        : () => {
            throw new Error("HTML parser is not configured.");
          });

    const {
      computeLineEdgeOffset,
      computeVerticalOffset,
      moveHorizontal,
      moveLineEdge,
      moveVertical,
      extendSelection,
    } = createSelectionMovement({
      getLayout: () => layout,
      getLayoutIndex: () => layoutIndex,
      getCaretOffset: () => caretOffset,
      setCaretOffset,
      getText,
      getPreferredX: () => preferredX,
      updateCaret,
      scrollArea: dom.scrollArea,
      getSelectionAnchorOffset: () =>
        getSelectionAnchorOffset(this.state, docPosToTextOffset, clampOffset),
      setSelectionOffsets,
    });

    // 指针/鼠标事件。
    const { handlePointerDown, handlePointerMove, handlePointerUp } = createPointerHandlers({
      getLayout: () => layout,
      scrollArea: dom.scrollArea,
      inputEl: dom.input,
      getText,
      posAtCoords,
      setSelectionOffsets,
      getSelectionAnchorOffset: () =>
        getSelectionAnchorOffset(this.state, docPosToTextOffset, clampOffset),
      setPreferredX: (value) => {
        preferredX = value;
      },
    });

    const editorHandlers = {
      handleBeforeInput: (event) => dispatchEditorProp("handleBeforeInput", event),
      handleKeyDown: (event) => dispatchEditorProp("handleKeyDown", event),
      handleCompositionStart: (event) => dispatchEditorProp("handleCompositionStart", event),
      handleCompositionUpdate: (event) => dispatchEditorProp("handleCompositionUpdate", event),
      handleCompositionEnd: (event) => dispatchEditorProp("handleCompositionEnd", event),
      handlePaste: (event) => dispatchEditorProp("handlePaste", event),
      handleInput: (event) => dispatchEditorProp("handleInput", event),
      handleCopy: (event) => dispatchEditorProp("handleCopy", event),
      handleCut: (event) => dispatchEditorProp("handleCut", event),
    };

    const supportsBeforeInput = "onbeforeinput" in dom.input;

    const {
      handleBeforeInput,
      handleKeyDown,
      handleCompositionStart,
      handleCompositionUpdate,
      handleCompositionEnd,
      handlePaste,
      handleInput,
    } = createInputHandlers({
      getEditorState: () => this.state,
      dispatchTransaction,
      runCommand,
      basicCommands,
      setBlockAlign,
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
      supportsBeforeInput,
      getIsComposing: () => isComposing,
      setIsComposing: (value) => {
        isComposing = value;
      },
      inputEl: dom.input,
      parseHtmlToSlice,
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
      editorHandlers,
    });

    const { handleCopy, handleCut } = createClipboardHandlers({
      getEditorState: () => this.state,
      dispatchTransaction,
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
      editorHandlers,
    });

    const detachInputBridge = attachInputBridge(dom.input, {
      onBeforeInput: handleBeforeInput,
      onInput: handleInput,
      onKeyDown: handleKeyDown,
      onCompositionStart: handleCompositionStart,
      onCompositionUpdate: handleCompositionUpdate,
      onCompositionEnd: handleCompositionEnd,
      onPaste: handlePaste,
      onCopy: handleCopy,
      onCut: handleCut,
    });

    const { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } =
      createTouchHandlers({
        getLayout: () => layout,
        scrollArea: dom.scrollArea,
        getText,
        posAtCoords,
        setSelectionOffsets,
        getSelectionAnchorOffset: () =>
          getSelectionAnchorOffset(this.state, docPosToTextOffset, clampOffset),
        setPreferredX: (value) => {
          preferredX = value;
        },
        dispatchEditorProp,
        inputEl: dom.input,
        longPressDelay: settings?.touch?.longPressDelay,
        tapMoveThreshold: settings?.touch?.tapMoveThreshold,
      });

    dragHandlers = createDragHandlers({
      view: this,
      settings,
      scrollArea: dom.scrollArea,
      getLayout: () => layout,
      getLayoutIndex: () => layoutIndex,
      getText,
      getState: () => this.state,
      getEventCoords,
      getDocPosFromCoords,
      serializeSliceToHtml,
      createSliceFromText,
      parseHtmlToSlice,
      dispatchEditorProp,
      dispatchTransaction,
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
      scheduleRender,
    });

    const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } =
      dragHandlers;

    const resolveNodeViewEntry = (nodeView) => {
      if (!nodeView) {
        return null;
      }
      for (const entry of nodeViews.values()) {
        if (entry.view === nodeView) {
          return entry;
        }
      }
      return null;
    };

    const syncNodeViewSelection = () => {
      let nextKey = null;
      const selection = this.state?.selection;
      if (selection instanceof NodeSelection) {
        nextKey = getNodeViewKey(selection.node, selection.from);
      }

      if (nextKey === selectedNodeViewKey) {
        return;
      }

      if (selectedNodeViewKey && nodeViews.has(selectedNodeViewKey)) {
        const entry = nodeViews.get(selectedNodeViewKey);
        if (entry?.view) {
          entry.view.isSelected = false;
          entry.view.deselectNode?.();
        }
      }

      selectedNodeViewKey = nextKey;

      if (selectedNodeViewKey && nodeViews.has(selectedNodeViewKey)) {
        const entry = nodeViews.get(selectedNodeViewKey);
        if (entry?.view) {
          entry.view.isSelected = true;
          entry.view.selectNode?.();
        }
      }
    };

    const syncNodeViews = () => {
      if (!this.state?.doc) {
        return;
      }
      if (!nodeRegistry && !nodeViewFactories) {
        return;
      }

      const decorations = typeof getDecorations === "function" ? getDecorations() : null;
      lastNodeViewDecorations = decorations;

      const nextViews = new Map();
      const nextByBlockId = new Map();

      this.state.doc.descendants((node, pos) => {
        const renderer = nodeRegistry?.get?.(node.type.name);
        const factory = nodeViewFactories?.[node.type.name] ?? renderer?.createNodeView;
        if (typeof factory !== "function") {
          return;
        }

        const key = getNodeViewKey(node, pos);
        let entry = nodeViews.get(key);

        if (!entry) {
          entry = { node, pos, view: null, key, blockId: node.attrs?.id ?? null };
          entry.getPos = () => entry.pos;
          const view = factory(node, this, entry.getPos);
          if (!view) {
            return;
          }
          entry.view = view;
        } else {
          const shouldUpdate = entry.view?.update?.(node, decorations);
          if (shouldUpdate === false) {
            entry.view?.destroy?.();
            entry = null;
          } else if (entry) {
            entry.node = node;
            entry.pos = pos;
            entry.blockId = node.attrs?.id ?? entry.blockId;
          }
        }

        if (entry) {
          nextViews.set(key, entry);
          if (entry.blockId) {
            nextByBlockId.set(entry.blockId, entry);
          }
        }
      });

      for (const [key, entry] of nodeViews.entries()) {
        if (!nextViews.has(key)) {
          entry.view?.destroy?.();
        }
      }

      nodeViews.clear();
      nodeViewsByBlockId.clear();
      for (const [key, entry] of nextViews.entries()) {
        nodeViews.set(key, entry);
      }
      for (const [blockId, entry] of nextByBlockId.entries()) {
        nodeViewsByBlockId.set(blockId, entry);
      }

      syncNodeViewSelection();
    };

    const destroyNodeViews = () => {
      for (const entry of nodeViews.values()) {
        entry.view?.destroy?.();
      }
      nodeViews.clear();
      nodeViewsByBlockId.clear();
      selectedNodeViewKey = null;
      lastNodeViewDecorations = null;
    };

    const handleNodeViewClick = (event, handlerName) => {
      const coords = getEventCoords(event);
      const nodeView = getNodeViewAtCoords(coords);
      if (nodeView && typeof nodeView[handlerName] === "function") {
        const handled = nodeView[handlerName](coords.x, coords.y);
        if (handled) {
          return true;
        }
      }

      const entry = resolveNodeViewEntry(nodeView);
      if (entry?.node && NodeSelection.isSelectable(entry.node)) {
        const tr = this.state.tr.setSelection(
          NodeSelection.create(this.state.doc, entry.pos)
        );
        dispatchTransaction(tr);
        return true;
      }

      return false;
    };

    const onClickFocus = (event) => {
      const coords = getEventCoords(event);
      const pos = getDocPosFromCoords(coords);
      if (dispatchEditorProp("handleClick", pos, event)) {
        event.preventDefault();
        return;
      }
      if (handleNodeViewClick(event, "handleClick")) {
        event.preventDefault();
        dom.input.focus();
        return;
      }
      dom.input.focus();
    };

    const onDoubleClick = (event) => {
      const coords = getEventCoords(event);
      const pos = getDocPosFromCoords(coords);
      if (dispatchEditorProp("handleDoubleClick", pos, event)) {
        event.preventDefault();
        return;
      }
      if (handleNodeViewClick(event, "handleDoubleClick")) {
        event.preventDefault();
      }
    };

    const onRootFocus = () => {
      dom.input.focus();
    };

    const onScroll = () => {
      updateCaret(false);
      scheduleRender();
    };

    dom.input.addEventListener("focus", updateStatus);
    dom.input.addEventListener("blur", updateStatus);
    dom.scrollArea.addEventListener("scroll", onScroll);
    dom.scrollArea.addEventListener("pointerdown", handlePointerDown);
    dom.scrollArea.addEventListener("pointermove", handlePointerMove);
    dom.scrollArea.addEventListener("pointerup", handlePointerUp);
    dom.scrollArea.addEventListener("pointercancel", handlePointerUp);
    dom.scrollArea.addEventListener("touchstart", handleTouchStart, { passive: false });
    dom.scrollArea.addEventListener("touchmove", handleTouchMove, { passive: false });
    dom.scrollArea.addEventListener("touchend", handleTouchEnd);
    dom.scrollArea.addEventListener("touchcancel", handleTouchCancel);
    dom.scrollArea.addEventListener("dragstart", handleDragStart);
    dom.scrollArea.addEventListener("dragover", handleDragOver);
    dom.scrollArea.addEventListener("dragleave", handleDragLeave);
    dom.scrollArea.addEventListener("drop", handleDrop);
    dom.scrollArea.addEventListener("dragend", handleDragEnd);
    dom.scrollArea.addEventListener("click", onClickFocus);
    dom.scrollArea.addEventListener("dblclick", onDoubleClick);
    dom.root.addEventListener("focus", onRootFocus);

    const onResize = () => {
      updateCaret(false);
      scheduleRender();
    };
    window.addEventListener("resize", onResize);

    initPluginViews();

    // 初始布局与渲染。
    updateLayout();
    syncNodeViews();
    syncAfterStateChange();
    updateA11yStatus();

    this._internals = {
      dom,
      settings,
      renderer,
      onChange,
      layoutPipeline,
      renderSync,
      getText,
      getLayout: () => layout,
      getLayoutIndex: () => layoutIndex,
      getRafId: () => rafId,
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
    };
  }

  // 外部更新 state 时调用。
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
  }

  // 直接派发 Transaction。
  dispatch(tr) {
    if (!tr) {
      return;
    }
    const dispatchTransaction = this._internals.dispatchTransaction;
    if (dispatchTransaction) {
      dispatchTransaction(tr);
      return;
    }
    const prevState = this.state;
    const nextState = applyTransaction(prevState, tr);
    const shouldScroll = tr?.scrolledIntoView;
    const changeEvent = createChangeEvent(tr, prevState, nextState);
    if (changeEvent?.summary?.blocks?.ids?.length) {
      this._internals.layoutPipeline?.invalidateBlocks(changeEvent.summary.blocks.ids);
    }
    if (this._internals.onChange) {
      this._internals.onChange(changeEvent);
    }
    this._internals.setPendingChangeSummary?.(changeEvent.summary || null);
    this.updateState(nextState);
    if (shouldScroll) {
      this.scrollIntoView();
    }
  }

  // 文档位置 -> 视口坐标。
  coordsAtPos(pos) {
    if (!this.state?.doc) {
      return null;
    }
    const layout = this._internals.getLayout?.() ?? null;
    if (!layout) {
      return null;
    }
    const textLength = this._internals.getText()?.length ?? 0;
    const offset = docPosToTextOffset(this.state.doc, pos);
    const rect = coordsAtPos(
      layout,
      offset,
      this._internals.dom.scrollArea.scrollTop,
      this._internals.dom.scrollArea.clientWidth,
      textLength
    );
    if (!rect) {
      return null;
    }
    return {
      left: rect.x,
      right: rect.x + 1,
      top: rect.y,
      bottom: rect.y + rect.height,
    };
  }

  // 视口坐标 -> 文档位置。
  posAtCoords(coords) {
    if (!coords || !this.state?.doc) {
      return null;
    }
    const layout = this._internals.getLayout?.() ?? null;
    if (!layout) {
      return null;
    }
    const x = coords.left ?? coords.x;
    const y = coords.top ?? coords.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    const textLength = this._internals.getText()?.length ?? 0;
    const offset = posAtCoords(
      layout,
      x,
      y,
      this._internals.dom.scrollArea.scrollTop,
      this._internals.dom.scrollArea.clientWidth,
      textLength
    );
    if (offset == null) {
      return null;
    }
    return textOffsetToDocPos(this.state.doc, offset);
  }

  // 滚动到选区或指定位置。
  scrollIntoView(pos?: number) {
    if (!this.state?.doc) {
      return;
    }
    const layout = this._internals.getLayout?.() ?? null;
    if (!layout) {
      return;
    }
    const scrollArea = this._internals.dom.scrollArea;
    const targetPos = Number.isFinite(pos) ? pos : this.state?.selection?.head ?? 0;
    const textLength = this._internals.getText()?.length ?? 0;
    const offset = docPosToTextOffset(this.state.doc, targetPos);
    const rect = coordsAtPos(
      layout,
      offset,
      scrollArea.scrollTop,
      scrollArea.clientWidth,
      textLength
    );
    if (!rect) {
      return;
    }
    const settings = this._internals.settings || {};
    const margin = Number.isFinite(settings.scrollMargin)
      ? settings.scrollMargin
      : Number.isFinite(settings.lineHeight)
      ? settings.lineHeight
      : 0;
    const viewportHeight = scrollArea.clientHeight;
    const currentScrollTop = scrollArea.scrollTop;
    let nextScrollTop = currentScrollTop;
    if (rect.y < margin) {
      nextScrollTop = Math.max(0, currentScrollTop + rect.y - margin);
    } else if (rect.y + rect.height > viewportHeight - margin) {
      nextScrollTop = Math.max(
        0,
        currentScrollTop + rect.y + rect.height + margin - viewportHeight
      );
    }
    if (Number.isFinite(nextScrollTop) && nextScrollTop !== currentScrollTop) {
      scrollArea.scrollTop = nextScrollTop;
    }
  }

  // 聚焦输入层。
  focus() {
    this._internals.dom.input.focus();
  }

  // 移除事件监听与 DOM。
  destroy() {
    const {
      dom,
      detachInputBridge,
      onScroll,
      onResize,
      onClickFocus,
      onDoubleClick,
      onRootFocus,
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
      destroyNodeViews,
      destroyPluginViews,
      clearDomEventHandlers,
      getRafId,
    } = this._internals;

    detachInputBridge?.();
    destroyNodeViews?.();
    destroyPluginViews?.();
    clearDomEventHandlers?.();
    dom.input.removeEventListener("focus", this._internals.renderSync.updateStatus);
    dom.input.removeEventListener("blur", this._internals.renderSync.updateStatus);
    dom.scrollArea.removeEventListener("scroll", onScroll);
    dom.scrollArea.removeEventListener("pointerdown", handlePointerDown);
    dom.scrollArea.removeEventListener("pointermove", handlePointerMove);
    dom.scrollArea.removeEventListener("pointerup", handlePointerUp);
    dom.scrollArea.removeEventListener("pointercancel", handlePointerUp);
    dom.scrollArea.removeEventListener("touchstart", handleTouchStart);
    dom.scrollArea.removeEventListener("touchmove", handleTouchMove);
    dom.scrollArea.removeEventListener("touchend", handleTouchEnd);
    dom.scrollArea.removeEventListener("touchcancel", handleTouchCancel);
    dom.scrollArea.removeEventListener("dragstart", handleDragStart);
    dom.scrollArea.removeEventListener("dragover", handleDragOver);
    dom.scrollArea.removeEventListener("dragleave", handleDragLeave);
    dom.scrollArea.removeEventListener("drop", handleDrop);
    dom.scrollArea.removeEventListener("dragend", handleDragEnd);
    dom.scrollArea.removeEventListener("click", onClickFocus);
    dom.scrollArea.removeEventListener("dblclick", onDoubleClick);
    dom.root.removeEventListener("focus", onRootFocus);
    window.removeEventListener("resize", onResize);

    const rafId = getRafId?.();
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    if (this.dom.parentNode) {
      this.dom.parentNode.removeChild(this.dom);
    }
  }
}
