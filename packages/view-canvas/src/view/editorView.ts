import { DOMParser as PMDOMParser } from "lumenpage-model";
import { NodeSelection, Selection, TextSelection } from "lumenpage-state";

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
import { createLayoutWorkerClient } from "./layoutWorkerClient";
import { createSelectionMovement } from "./selectionMovement";
import { coordsAtPos, posAtCoords } from "./posIndex";
import { getCaretFromPoint } from "./caret";
import { GapCursor } from "lumenpage-gapcursor";
import { selectionToRects, activeBlockToRects } from "./render/selection";
import { buildLayoutIndex, getFirstLineForBlockId, getLineAtOffset } from "./layoutIndex";

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
  commands;
  _internals;
  overlayHost;
  composing;

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

    const debugConfig = resolveCanvasConfig("debug", {});
    // 鍒濆鍖?DOM銆佹牱寮忎笌鏃犻殰纰嶉厤缃€?
    const dom = resolveCanvasConfig("elements") ?? createDefaultDom();
    const settings = { ...DEFAULT_SETTINGS, ...(resolveCanvasConfig("settings") || {}) };
    const tablePanel = resolveCanvasConfig("tablePaginationPanelEl") ?? null;
    if (tablePanel) {
      settings.tablePaginationPanelEl = tablePanel;
    }
    settings.debugLayout = debugConfig?.layout === true;
    if (settings.debugPerf) {
      settings.__perf = { layout: null, render: null };
    }
    const basePageWidth = settings.pageWidth;
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

    if (settings.debugPerf) {
      const host = dom.overlayHost ?? dom.root;
      const panel = document.createElement("div");
      panel.className = "lumenpage-perf-panel";
      panel.style.position = "absolute";
      panel.style.right = "12px";
      panel.style.top = "12px";
      panel.style.zIndex = "10";
      panel.style.background = "rgba(15, 23, 42, 0.85)";
      panel.style.color = "#e2e8f0";
      panel.style.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
      panel.style.padding = "8px 10px";
      panel.style.borderRadius = "6px";
      panel.style.pointerEvents = "none";
      panel.style.whiteSpace = "pre";
      panel.textContent = "perf: waiting...";
      host.appendChild(panel);
      settings.perfPanelEl = panel;
    }

    const nodeRegistry = resolveCanvasConfig("nodeRegistry") ?? null;
    const layoutWorkerConfig = resolveCanvasConfig("layoutWorker") ?? null;

    const layoutWorkerClient = createLayoutWorkerClient({
      settings,
      schema,
      config: layoutWorkerConfig,
    });
    const nodeViewFactories = viewProps.nodeViews ?? null;
    const status = resolveCanvasConfig("statusElement") ?? document.createElement("div");

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
      enter: commandConfig.basicCommands?.enter ?? noopCommand,
      undo: commandConfig.basicCommands?.undo ?? noopCommand,
      redo: commandConfig.basicCommands?.redo ?? noopCommand,
    };
    const setBlockAlign = commandConfig.setBlockAlign ?? (() => noopCommand);
    const viewCommandConfig = commandConfig.viewCommands;
    const resolvedViewCommands =
      typeof viewCommandConfig === "function"
        ? viewCommandConfig({ schema, basicCommands, setBlockAlign })
        : viewCommandConfig;
    const commandMap =
      resolvedViewCommands && typeof resolvedViewCommands === "object" ? resolvedViewCommands : {};
    const runViewCommand = (cmd, args) => {
      if (typeof cmd !== "function") {
        return false;
      }
      if (args.length > 0) {
        const maybe = cmd(...args);
        if (typeof maybe === "function") {
          return runCommand(maybe, this.state, this.dispatch.bind(this), this);
        }
        if (typeof maybe === "boolean") {
          return maybe;
        }
      }
      if (cmd.length >= 2) {
        return runCommand(cmd, this.state, this.dispatch.bind(this), this);
      }
      const maybe = cmd();
      if (typeof maybe === "function") {
        return runCommand(maybe, this.state, this.dispatch.bind(this), this);
      }
      if (typeof maybe === "boolean") {
        return maybe;
      }
      return false;
    };
    this.commands = {};
    for (const [name, cmd] of Object.entries(commandMap)) {
      this.commands[name] = (...args) => runViewCommand(cmd, args);
    }
    this.commands.run = (cmd, ...args) => runViewCommand(cmd, args);

    // NodeView 绠＄悊銆?
    const nodeViews = new Map();
    const nodeViewsByBlockId = new Map();
    let selectedNodeViewKey = null;
    let lastNodeViewDecorations = null;
    let skipNextClickSelection = false;

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
      const scrollTop = dom.scrollArea.scrollTop;
      const viewportWidth = dom.scrollArea.clientWidth;
      const viewportHeight = dom.scrollArea.clientHeight;
      const pageSpan = layout.pageHeight + layout.pageGap;
      const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);

      for (const [blockId, entry] of nodeViewsByBlockId) {
        const item = getFirstLineForBlockId(layoutIndex, blockId);
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


    // 鏍规嵁瑙嗗彛瀹藉害璁＄畻瀹為檯椤甸潰瀹藉害銆?
    const resolvePageWidth = () => {
      const width = dom.scrollArea?.clientWidth ?? 0;
      if (!Number.isFinite(width) || width <= 0) {
        return basePageWidth;
      }
      return Math.min(basePageWidth, width);
    };

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

    const logSelection = debugConfig?.selection
      ? createSelectionLogger({ getText, docPosToTextOffset, clampOffset })
      : () => {};
    const logDelete = debugConfig?.delete
      ? (phase, payload) => {
          console.log("[delete]", phase, payload);
        }
      : () => {};
    const debugLog = debugConfig?.selection
      ? (label, payload) => console.log(`[selection:${label}]`, payload)
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

    // 缁熶竴娲惧彂 Transaction 鐨勫叆鍙ｃ€?
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
      pendingSteps = changeEvent.steps || null;
      this.updateState(nextState);
      if (shouldScroll) {
        this.scrollIntoView();
      }
    };

    const setSelectionOffsets = (anchorOffset, headOffset, updatePreferred, forceText = false) => {
      if (!Number.isFinite(anchorOffset) || !Number.isFinite(headOffset)) {
        return;
      }

      const currentSelection = this.state.selection;
      if (!forceText && currentSelection instanceof NodeSelection) {
        const anchorPos = textOffsetToDocPos(this.state.doc, anchorOffset);
        const headPos = textOffsetToDocPos(this.state.doc, headOffset);
        if (anchorPos === currentSelection.anchor && headPos === currentSelection.head) {
          return;
        }
      }

      pendingPreferredUpdate = updatePreferred;

      const anchorPos = textOffsetToDocPos(this.state.doc, anchorOffset);
      const headPos = textOffsetToDocPos(this.state.doc, headOffset);
      if (!Number.isFinite(anchorPos) || !Number.isFinite(headPos)) {
        return;
      }

      let selection;
      try {
        selection = TextSelection.create(this.state.doc, anchorPos, headPos);
      } catch (error) {
        selection = Selection.near(this.state.doc.resolve(headPos), headPos < anchorPos ? -1 : 1);
      }
      const tr = this.state.tr.setSelection(selection);
      debugLog("setSelectionOffsets", {
        anchorOffset,
        headOffset,
        anchorPos,
        headPos,
      });
      dispatchTransaction(tr);
    };

    const setSelectionFromHit = (hit, event) => {
      if (!hit || !hit.line || event?.shiftKey) {
        return false;
      }
      const line = hit.line;
      const selectableTypes = new Set(["image", "video", "horizontal_rule"]);
      if (!selectableTypes.has(line.blockType)) {
        return false;
      }
      const findPosByBlockId = (blockId) => {
        if (!blockId || !this.state?.doc) {
          return null;
        }
        let found = null;
        this.state.doc.descendants((node, pos) => {
          if (node?.attrs?.id === blockId) {
            found = pos;
            return false;
          }
          return true;
        });
        return found;
      };
      let pos = null;
      const blockId = line.blockId;
      if (blockId && nodeViewsByBlockId.has(blockId)) {
        pos = nodeViewsByBlockId.get(blockId)?.pos ?? null;
      }
      if (!Number.isFinite(pos)) {
        pos = findPosByBlockId(blockId);
      }
      if (!Number.isFinite(pos)) {
        const blockStart = Number.isFinite(line.blockStart) ? line.blockStart : hit.offset;
        pos = textOffsetToDocPos(this.state.doc, blockStart);
      }
      if (!Number.isFinite(pos)) {
        return false;
      }
      const $pos = this.state.doc.resolve(pos);
      let node = $pos.nodeAfter;
      let selectPos = pos;
      if (blockId) {
        if (node?.attrs?.id !== blockId && $pos.nodeBefore?.attrs?.id === blockId) {
          selectPos = pos - $pos.nodeBefore.nodeSize;
          node = $pos.nodeBefore;
        }
      }
      if (!node || !NodeSelection.isSelectable(node)) {
        const prev = $pos.nodeBefore;
        if (prev && NodeSelection.isSelectable(prev)) {
          selectPos = pos - prev.nodeSize;
          node = prev;
        }
      }
      if (!node || !NodeSelection.isSelectable(node)) {
        return false;
      }
      const tr = this.state.tr.setSelection(NodeSelection.create(this.state.doc, selectPos));
      dispatchTransaction(tr);
      skipNextClickSelection = true;
      return true;
    };

    const setGapCursorAtCoords = (x, y, hit, event) => {
      if (!layout || event?.shiftKey) {
        return false;
      }
      if (hit?.line?.blockType) {
        const type = hit.line.blockType;
        if (type === "image" || type === "video" || type === "horizontal_rule") {
          return false;
        }
      }
      const pageSpan = layout.pageHeight + layout.pageGap;
      const absoluteY = y + dom.scrollArea.scrollTop;
      const pageIndex = Math.floor(absoluteY / pageSpan);
      if (pageIndex < 0 || pageIndex >= layout.pages.length) {
        return false;
      }
      const page = layout.pages[pageIndex];
      const localY = absoluteY - pageIndex * pageSpan;
      const lines = page.lines || [];
      const lineAtY = lines.find((line) => {
        const lineHeight = Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;
        return localY >= line.y && localY < line.y + lineHeight;
      });
      if (lineAtY) {
        return false;
      }
      let above = null;
      let below = null;
      for (const line of lines) {
        const lineHeight = Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;
        const bottom = line.y + lineHeight;
        if (bottom <= localY) {
          if (!above || bottom > above.bottom) {
            above = { line, bottom };
          }
        }
        if (line.y >= localY) {
          if (!below || line.y < below.top) {
            below = { line, top: line.y };
          }
        }
      }
      if (!above || !below) {
        return false;
      }
      const targetOffset = Number.isFinite(below.line.blockStart)
        ? below.line.blockStart
        : Number.isFinite(above.line.end)
          ? above.line.end
          : null;
      if (!Number.isFinite(targetOffset)) {
        return false;
      }
      const pos = textOffsetToDocPos(this.state.doc, targetOffset);
      if (!Number.isFinite(pos)) {
        return false;
      }
      const $pos = this.state.doc.resolve(pos);
      if (!GapCursor.valid($pos)) {
        return false;
      }
      const tr = this.state.tr.setSelection(new GapCursor($pos));
      dispatchTransaction(tr);
      skipNextClickSelection = true;
      return true;
    };

    // 缂栬緫鎿嶄綔灏佽锛堟彃鍏?鍒犻櫎/閫夊尯锛夈€?
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
        docPosToTextOffset,
        textOffsetToDocPos,
        createSelectionStateAtOffset,
        logDelete,
      });

    // HTML 瑙ｆ瀽閰嶇疆锛堢矘璐?瀵煎叆锛夈€?
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

    // 鎸囬拡浜嬩欢澶勭悊锛堥紶鏍?瑙︽帶锛夈€?
    const { handlePointerDown, handlePointerMove, handlePointerUp } = createPointerHandlers({
      getLayout: () => layout,
      scrollArea: dom.scrollArea,
      inputEl: dom.input,
      getText,
      posAtCoords,
      getHitAtCoords: (x, y) =>
        getCaretFromPoint(
          layout,
          x,
          y,
          dom.scrollArea.scrollTop,
          dom.scrollArea.clientWidth,
          getText().length
        ),
      setSelectionOffsets: (anchor, head, updatePreferred) =>
        setSelectionOffsets(anchor, head, updatePreferred, true),
      setSelectionFromHit,
      setGapCursorAtCoords,
      shouldDeferSelection: (hit, hitOffset) => {
        if (!layout || !Number.isFinite(hitOffset)) {
          return false;
        }
        if (hit?.line?.blockType) {
          const type = hit.line.blockType;
          if (type === "image" || type === "video" || type === "horizontal_rule") {
            return false;
          }
        }
        const pos = textOffsetToDocPos(this.state.doc, hitOffset);
        if (!Number.isFinite(pos)) {
          return false;
        }
        const $pos = this.state.doc.resolve(pos);
        return GapCursor.valid($pos);
      },
      getSelectionAnchorOffset: () =>
        getSelectionAnchorOffset(this.state, docPosToTextOffset, clampOffset),
      setPreferredX: (value) => {
        preferredX = value;
      },
    });

    const editorHandlers = {
      handleBeforeInput: (event) => dispatchEditorProp("handleBeforeInput", event),
      handleKeyDown: (event) => dispatchEditorProp("handleKeyDown", event),
      handleKeyPress: (event) => dispatchEditorProp("handleKeyPress", event),
      handleTextInput: (from, to, text) => dispatchEditorProp("handleTextInput", from, to, text),
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
      handleKeyPress,
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
        this.composing = value;
      },
      inputEl: dom.input,
      parseHtmlToSlice,
      setPendingPreferredUpdate: (value) => {
        pendingPreferredUpdate = value;
      },
      editorHandlers,
    });
    const resetComposing = () => {
      isComposing = false;
      this.composing = false;
    };

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
      onKeyPress: handleKeyPress,
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
      debugLog("click", { pos, coords });
      if (skipNextClickSelection) {
        skipNextClickSelection = false;
        dom.input.focus();
        return;
      }
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
    dom.input.addEventListener("blur", resetComposing);
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

    // 鍒濆甯冨眬涓庢覆鏌撱€?
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
      layoutWorker: layoutWorkerClient,
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
    };
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
  }

  // 鐩存帴娲惧彂 Transaction銆?
  dispatch(tr) {
    if (!tr) {
      return;
    }
    const dispatchTransaction = this._internals.dispatchTransaction;
    if (dispatchTransaction) {
      dispatchTransaction(tr);
    }
  }

  // 鍒ゆ柇鍏夋爣鏄惁鍒拌揪鏂囨湰鍧楄竟鐣屻€?

  endOfTextblock(dir = "forward", state = undefined) {
    const targetState = state || this.state;
    const selection = targetState?.selection;
    const cursor = selection?.$cursor || selection?.$from;
    if (!cursor) {
      return false;
    }
    const isBackward = dir === "backward" || dir === "left" || dir === "up";
    const isForward = dir === "forward" || dir === "right" || dir === "down";
    if (isBackward) {
      return cursor.parentOffset === 0;
    }
    if (isForward) {
      return cursor.parentOffset === cursor.parent.content.size;
    }
    return false;
  }

  // 鏂囨。浣嶇疆 -> 瑙嗗彛鍧愭爣銆?
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

  // 瑙嗗彛鍧愭爣 -> 鏂囨。浣嶇疆銆?
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

  // 灏嗘寚瀹氫綅缃粴鍔ㄥ埌鍙鍖哄煙銆?
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
    if (rect.y >= 0 && rect.y + rect.height <= viewportHeight) {
      return;
    }
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

  // 鑱氱劍杈撳叆灞傘€?
  focus() {
    this._internals.dom.input.focus();
  }

  // 绉婚櫎浜嬩欢鐩戝惉涓?DOM銆?
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
      layoutWorker: layoutWorkerClient,
      getRafId,
    } = this._internals;

    detachInputBridge?.();
    destroyNodeViews?.();
    destroyPluginViews?.();
    clearDomEventHandlers?.();
    layoutWorkerClient?.destroy?.();
    dom.input.removeEventListener("focus", this._internals.renderSync.updateStatus);
    dom.input.removeEventListener("blur", this._internals.renderSync.updateStatus);
    dom.input.removeEventListener("blur", this._internals.resetComposing);
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
























