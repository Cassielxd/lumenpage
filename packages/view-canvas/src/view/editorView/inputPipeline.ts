import { attachInputBridge } from "../input/bridge";
import { createClipboardHandlers } from "../input/clipboard";
import { createInputHandlers } from "../input/handlers";
import { isEditorDomEventHandled } from "./plugins";
import { serializeSliceToHtml } from "./text";

// 输入管线装配：聚合 editorProps 回调、beforeinput/input、剪贴板与输入桥接。
export const createEditorInputPipeline = ({
  view,
  dom,
  getState,
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
  getCaretOffset,
  parseHtmlToSlice,
  setPendingPreferredUpdate,
  setComposing,
  getIsComposing,
}) => {
  const editorHandlers = {
    handleBeforeInput: (event) => dispatchEditorProp("handleBeforeInput", event),
    handleKeyDown: (event) => dispatchEditorProp("handleKeyDown", event),
    handleKeyPress: (event) => dispatchEditorProp("handleKeyPress", event),
    handleTextInput: (from, to, text, deflt) =>
      dispatchEditorProp("handleTextInput", from, to, text, deflt),
    handleCompositionStart: (event) => dispatchEditorProp("handleCompositionStart", event),
    handleCompositionUpdate: (event) => dispatchEditorProp("handleCompositionUpdate", event),
    handleCompositionEnd: (event) => dispatchEditorProp("handleCompositionEnd", event),
    handlePaste: (event, slice) => dispatchEditorProp("handlePaste", event, slice),
    handleInput: (event) => dispatchEditorProp("handleInput", event),
    handleCopy: (event) => dispatchEditorProp("handleCopy", event),
    handleCut: (event) => dispatchEditorProp("handleCut", event),
  };

  const transformCopied = (slice) => queryEditorProp("transformCopied", slice) ?? slice;
  const transformCopiedHTML = (html, slice) =>
    queryEditorProp("transformCopiedHTML", html, slice) ?? html;
  const transformPasted = (slice) => queryEditorProp("transformPasted", slice) ?? slice;
  const transformPastedText = (text, plain) =>
    queryEditorProp("transformPastedText", text, plain) ?? text;
  const transformPastedHTML = (html) => queryEditorProp("transformPastedHTML", html) ?? html;
  const clipboardTextSerializer = (slice) =>
    queryEditorProp("clipboardTextSerializer", slice) ?? null;
  const serializeSliceToHtmlForClipboard = (slice, schema) => {
    const serializer = queryEditorProp("clipboardSerializer");
    if (serializer && typeof serializer.serializeFragment === "function") {
      const ownerDocument =
        dom?.root?.ownerDocument || (typeof document !== "undefined" ? document : null);
      if (!ownerDocument) {
        return "";
      }
      const container = ownerDocument.createElement("div");
      container.appendChild(serializer.serializeFragment(slice.content));
      return container.innerHTML;
    }
    return serializeSliceToHtml(slice, schema, dom?.root?.ownerDocument ?? null);
  };
  const clipboardTextParser = (text, plain) => {
    const state = getState();
    const context = state?.selection?.$from ?? null;
    return queryEditorProp("clipboardTextParser", text, context, plain) ?? null;
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
    getEditorState: getState,
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
    getCaretOffset,
    supportsBeforeInput,
    getIsComposing,
    setIsComposing: setComposing,
    inputEl: dom.input,
    parseHtmlToSlice,
    transformPasted,
    transformPastedText,
    transformPastedHTML,
    clipboardTextParser,
    setPendingPreferredUpdate,
    editorHandlers,
  });

  const { handleCopy, handleCut } = createClipboardHandlers({
    getEditorState: getState,
    getOwnerDocument: () => dom?.root?.ownerDocument || null,
    dispatchTransaction,
    setPendingPreferredUpdate,
    editorHandlers,
    transformCopied,
    clipboardTextSerializer,
    transformCopiedHTML,
    serializeSliceToHtml: serializeSliceToHtmlForClipboard,
  });

  const shouldSkipHandledDomEvent = (event) =>
    event?.defaultPrevented || isEditorDomEventHandled(event);

  const detachInputBridge = attachInputBridge(dom.input, {
    onBeforeInput: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handleBeforeInput(event);
    },
    onInput: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handleInput(event);
    },
    onKeyDown: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handleKeyDown(event);
    },
    onKeyPress: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handleKeyPress(event);
    },
    onCompositionStart: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handleCompositionStart(event);
    },
    onCompositionUpdate: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handleCompositionUpdate(event);
    },
    onCompositionEnd: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handleCompositionEnd(event);
    },
    onPaste: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handlePaste(event);
    },
    onCopy: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handleCopy(event);
    },
    onCut: (event) => {
      if (shouldSkipHandledDomEvent(event)) {
        return;
      }
      handleCut(event);
    },
  });

  const resetComposing = () => {
    setComposing(false);
  };

  return {
    detachInputBridge,
    resetComposing,
    clipboardTextSerializer,
    serializeSliceToHtmlForClipboard,
    debugInputHandlers: {
      handleBeforeInput,
      handleCompositionStart,
      handleCompositionUpdate,
      handleCompositionEnd,
      handlePaste,
      handleInput,
    },
  };
};
