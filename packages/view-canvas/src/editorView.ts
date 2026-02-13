import { DOMParser as PMDOMParser } from "lumenpage-model";
import { TextSelection } from "lumenpage-state";

import {
  applyTransaction,
  basicCommands,
  createChangeEvent,
  createEditorOps,
  createEditorState,
  createSelectionLogger,
  createSelectionStateAtOffset,
  docPosToTextOffset,
  getSelectionAnchorOffset,
  getSelectionOffsets,
  LayoutPipeline,
  runCommand,
  setBlockAlign,
  textOffsetToDocPos,
} from "lumenpage-core";

import { attachInputBridge } from "./input/bridge";
import { createInputHandlers } from "./input/handlers";
import { createPointerHandlers } from "./input/pointerHandlers";
import { createHtmlParser } from "./htmlParser";
import { createRenderSync } from "./renderSync";
import { createSelectionMovement } from "./selectionMovement";
import { coordsAtPos, posAtCoords } from "./posIndex";
import { selectionToRects, activeBlockToRects } from "./render/selection";
import { buildLayoutIndex } from "./layoutIndex";

import { measureTextWidth } from "./measure";
import { Renderer } from "./renderer";

const DEFAULT_SETTINGS = {
  pageWidth: 816,
  pageHeight: 720,
  pageGap: 24,
  margin: {
    top: 72,
    right: 72,
    bottom: 72,
    left: 72,
  },
  lineHeight: 22,
  font: "16px Arial",
  wrapTolerance: 2,
  pageBuffer: 1,
  maxPageCache: 16,
  selectionStyle: {
    fill: "rgba(191, 219, 254, 0.4)",
    stroke: "rgba(59, 130, 246, 0.8)",
    strokeWidth: 1,
    radius: 2,
    inset: 0,
  },
  blockSelection: {
    enabled: true,
    onlyWhenFocused: true,
    types: ["paragraph", "heading", "image"],
  },
  measureTextWidth,
};

const createDefaultDom = () => {
  const root = document.createElement("div");
  root.className = "lumenpage-editor";

  const viewport = document.createElement("div");
  viewport.className = "lumenpage-viewport";

  const scrollArea = document.createElement("div");
  scrollArea.className = "lumenpage-scroll-area";

  const spacer = document.createElement("div");
  spacer.className = "lumenpage-spacer";
  scrollArea.appendChild(spacer);

  const pageLayer = document.createElement("div");
  pageLayer.className = "lumenpage-page-layer";

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.className = "lumenpage-overlay";

  const inputHost = document.createElement("div");
  inputHost.className = "lumenpage-input-host";

  const input = document.createElement("textarea");
  input.className = "lumenpage-input";
  input.spellcheck = false;
  inputHost.appendChild(input);

  viewport.append(scrollArea, pageLayer, overlayCanvas, inputHost);
  root.appendChild(viewport);

  return { root, viewport, scrollArea, spacer, pageLayer, overlayCanvas, inputHost, input };
};

const applyDefaultStyles = (dom, settings) => {
  dom.root.style.position = "relative";
  dom.root.style.width = "100%";
  dom.root.style.height = "100%";
  dom.root.style.overflow = "hidden";

  dom.viewport.style.position = "relative";
  dom.viewport.style.width = "100%";
  dom.viewport.style.height = "100%";
  dom.viewport.style.overflow = "hidden";

  dom.scrollArea.style.position = "absolute";
  dom.scrollArea.style.inset = "0";
  dom.scrollArea.style.overflow = "auto";

  dom.pageLayer.style.position = "absolute";
  dom.pageLayer.style.inset = "0";
  dom.pageLayer.style.pointerEvents = "none";

  dom.overlayCanvas.style.position = "absolute";
  dom.overlayCanvas.style.inset = "0";
  dom.overlayCanvas.style.width = "100%";
  dom.overlayCanvas.style.height = "100%";
  dom.overlayCanvas.style.pointerEvents = "none";

  dom.inputHost.style.position = "absolute";
  dom.inputHost.style.inset = "0";
  dom.inputHost.style.pointerEvents = "none";

  dom.input.style.position = "absolute";
  dom.input.style.width = "2px";
  dom.input.style.height = `${settings.lineHeight}px`;
  dom.input.style.padding = "0";
  dom.input.style.margin = "0";
  dom.input.style.border = "none";
  dom.input.style.outline = "none";
  dom.input.style.resize = "none";
  dom.input.style.overflow = "hidden";
  dom.input.style.background = "transparent";
  dom.input.style.color = "transparent";
  dom.input.style.caretColor = "#111827";
  dom.input.style.font = settings.font;
  dom.input.style.lineHeight = `${settings.lineHeight}px`;
};

export class CanvasEditorView {
  dom;
  state;

  constructor(place, props) {
    const dom = props?.elements ?? createDefaultDom();
    const settings = { ...DEFAULT_SETTINGS, ...(props?.settings || {}) };
    const applyStyles = props?.applyDefaultStyles ?? true;

    if (applyStyles) {
      applyDefaultStyles(dom, settings);
    }

    const mountTarget = place?.mount ?? place;
    if (mountTarget) {
      mountTarget.appendChild(dom.root);
    }

    this.dom = dom.root;

    const schema = props?.schema ?? props?.state?.schema;
    const editorState =
      props?.state ??
      createEditorState({
        schema,
        createDocFromText: props?.createDocFromText,
        text: props?.text ?? "",
        doc: props?.doc ?? null,
        json: props?.json ?? null,
        plugins: props?.plugins ?? [],
      });

    this.state = editorState;

    const nodeRegistry = props?.nodeRegistry ?? null;
    const status = props?.statusElement ?? document.createElement("div");

    const layoutPipeline = new LayoutPipeline(settings, nodeRegistry);
    const renderer = new Renderer(dom.pageLayer, dom.overlayCanvas, settings, nodeRegistry);

    let layout = null;
    let layoutIndex = null;
    let rafId = 0;
    let caretOffset = 0;
    let caretRect = null;
    let preferredX = null;
    let pendingPreferredUpdate = true;
    let isComposing = false;

    const getText = () => {
      if (props?.getText) {
        return props.getText(this.state.doc);
      }
      if (!this.state?.doc) {
        return "";
      }
      return this.state.doc.textBetween(0, this.state.doc.content.size, "\n");
    };

    const setInputPosition = (x, y) => {
      dom.input.style.left = `${x}px`;
      dom.input.style.top = `${y}px`;
    };

    const clampOffset = (offset) => {
      const length = getText().length;
      return Math.max(0, Math.min(offset, length));
    };

    const logSelection = props?.debug?.selection
      ? createSelectionLogger({
          getText,
          docPosToTextOffset,
          clampOffset,
        })
      : () => {};

    const logDelete = props?.debug?.delete
      ? (phase, payload) => {
          console.log("[delete]", phase, payload);
        }
      : () => {};

    const renderSync = createRenderSync({
      getEditorState: () => this.state,
      setEditorState: (state) => {
        this.state = state;
      },
      applyTransaction,
      layoutPipeline,
      buildLayoutIndex,
      renderer,
      spacer: dom.spacer,
      scrollArea: dom.scrollArea,
      status,
      inputEl: dom.input,
      getText,
      clampOffset,
      docPosToTextOffset,
      getSelectionOffsets,
      selectionToRects,
      activeBlockToRects,
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
      getLayoutIndex: () => layoutIndex,
      setLayoutIndex: (value) => {
        layoutIndex = value;
      },
      setLayout: (value) => {
        layout = value;
      },
      getRafId: () => rafId,
      setRafId: (value) => {
        rafId = value;
      },
      setInputPosition,
    });

    const { updateStatus, scheduleRender, updateCaret, updateLayout, syncAfterStateChange } =
      renderSync;

    const dispatchTransaction = (tr) => {
      if (props?.dispatchTransaction) {
        props.dispatchTransaction(tr);
        return;
      }
      const prevState = this.state;
      const nextState = applyTransaction(prevState, tr);
      const changeEvent = createChangeEvent(tr, prevState, nextState);
      if (changeEvent?.summary?.blocks?.ids?.length) {
        layoutPipeline.invalidateBlocks(changeEvent.summary.blocks.ids);
      }
      if (props?.onChange) {
        props.onChange(changeEvent);
      }
      this.updateState(nextState);
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

    const {
      setCaretOffset,
      insertText,
      insertTextWithBreaks,
      deleteSelectionIfNeeded,
      deleteText,
    } = createEditorOps({
      getEditorState: () => this.state,
      dispatchTransaction,
      runCommand,
      basicCommands,
  createChangeEvent,
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

    const parseHtmlToSlice =
      props?.parseHtmlToSlice ??
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

    const {
      handleBeforeInput,
      handleInput,
      handleKeyDown,
      handleCompositionStart,
      handleCompositionUpdate,
      handleCompositionEnd,
      handlePaste,
    } = createInputHandlers({
      getEditorState: () => this.state,
      dispatchTransaction,
      runCommand,
      basicCommands,
  createChangeEvent,
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
      supportsBeforeInput: "onbeforeinput" in dom.input,
      getIsComposing: () => isComposing,
      setIsComposing: (value) => {
        isComposing = value;
      },
      inputEl: dom.input,
      parseHtmlToSlice,
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
    });

    const detachInputBridge = attachInputBridge(dom.input, {
      onBeforeInput: handleBeforeInput,
      onInput: handleInput,
      onKeyDown: handleKeyDown,
      onCompositionStart: handleCompositionStart,
      onCompositionUpdate: handleCompositionUpdate,
      onCompositionEnd: handleCompositionEnd,
      onPaste: handlePaste,
    });

    dom.input.addEventListener("focus", updateStatus);
    dom.input.addEventListener("blur", updateStatus);

    const onScroll = () => {
      updateCaret(false);
      scheduleRender();
    };
    dom.scrollArea.addEventListener("scroll", onScroll);

    dom.scrollArea.addEventListener("pointerdown", handlePointerDown);
    dom.scrollArea.addEventListener("pointermove", handlePointerMove);
    dom.scrollArea.addEventListener("pointerup", handlePointerUp);
    dom.scrollArea.addEventListener("pointercancel", handlePointerUp);
    const onClickFocus = () => dom.input.focus();
    dom.scrollArea.addEventListener("click", onClickFocus);

    const onResize = () => {
      updateCaret(false);
      scheduleRender();
    };
    window.addEventListener("resize", onResize);

    updateLayout();
    syncAfterStateChange();

    this._internals = {
      dom,
      settings,
      renderer,
      onChange: props?.onChange,
      layoutPipeline,
      renderSync,
      getText,
      getLayout: () => layout,
      getLayoutIndex: () => layoutIndex,
      getRafId: () => rafId,
      dispatchTransaction,
      updateLayout,
      syncAfterStateChange,
      scheduleRender,
      updateCaret,
      detachInputBridge,
      onScroll,
      onResize,
      onClickFocus,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
    };
  }

  updateState(state) {
    const prev = this.state;
    this.state = state;

    if (prev?.doc !== state?.doc) {
      this._internals.updateLayout();
    }
    this._internals.syncAfterStateChange();
  }

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
    const changeEvent = createChangeEvent(tr, prevState, nextState);
    if (changeEvent?.summary?.blocks?.ids?.length) {
      this._internals.layoutPipeline?.invalidateBlocks(changeEvent.summary.blocks.ids);
    }
    if (this._internals.onChange) {
      this._internals.onChange(changeEvent);
    }
    this.updateState(nextState);
  }

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

  posAtCoords(coords) {
    const layout = this._internals.getLayout?.() ?? null;
    if (!layout) {
      return null;
    }
    const x = coords?.left ?? coords?.x ?? 0;
    const y = coords?.top ?? coords?.y ?? 0;
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

  focus() {
    this._internals.dom.input.focus();
  }

  destroy() {
    const {
      dom,
      detachInputBridge,
      onScroll,
      onResize,
      onClickFocus,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      getRafId,
    } = this._internals;

    detachInputBridge?.();
    dom.input.removeEventListener("focus", this._internals.renderSync.updateStatus);
    dom.input.removeEventListener("blur", this._internals.renderSync.updateStatus);
    dom.scrollArea.removeEventListener("scroll", onScroll);
    dom.scrollArea.removeEventListener("pointerdown", handlePointerDown);
    dom.scrollArea.removeEventListener("pointermove", handlePointerMove);
    dom.scrollArea.removeEventListener("pointerup", handlePointerUp);
    dom.scrollArea.removeEventListener("pointercancel", handlePointerUp);
    dom.scrollArea.removeEventListener("click", onClickFocus);
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
























