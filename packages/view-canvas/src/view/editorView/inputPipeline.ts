import { createClipboardHandlers } from "../input/clipboard";
import { createInputHandlers } from "../input/handlers";
import { attachEditorInputBridge } from "./inputPipeline/bridge";
import { createInputPipelineEditorHandlers } from "./inputPipeline/editorHandlers";

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
  const {
    editorHandlers,
    transformCopied,
    transformCopiedHTML,
    transformPasted,
    transformPastedText,
    transformPastedHTML,
    clipboardTextSerializer,
    serializeSliceToHtmlForClipboard,
    clipboardTextParser,
  } = createInputPipelineEditorHandlers({
    dom,
    getState,
    dispatchEditorProp,
    queryEditorProp,
  });

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

  const detachInputBridge = attachEditorInputBridge({
    inputEl: dom.input,
    handlers: {
      handleBeforeInput,
      handleInput,
      handleKeyDown,
      handleKeyPress,
      handleCompositionStart,
      handleCompositionUpdate,
      handleCompositionEnd,
      handlePaste,
      handleCopy,
      handleCut,
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
