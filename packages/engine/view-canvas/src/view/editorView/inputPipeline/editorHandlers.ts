import { serializeSliceToHtml } from "../text.js";

export const createInputPipelineEditorHandlers = ({
  dom,
  getState,
  dispatchEditorProp,
  queryEditorProp,
}: {
  dom: any;
  getState: () => any;
  dispatchEditorProp: (name: any, ...args: any[]) => boolean;
  queryEditorProp: (name: any, ...args: any[]) => any;
}) => {
  const editorHandlers = {
    handleBeforeInput: (event: any) => dispatchEditorProp("handleBeforeInput", event),
    handleKeyDown: (event: any) => dispatchEditorProp("handleKeyDown", event),
    handleKeyPress: (event: any) => dispatchEditorProp("handleKeyPress", event),
    handleTextInput: (from: any, to: any, text: any, deflt: any) =>
      dispatchEditorProp("handleTextInput", from, to, text, deflt),
    handleCompositionStart: (event: any) => dispatchEditorProp("handleCompositionStart", event),
    handleCompositionUpdate: (event: any) => dispatchEditorProp("handleCompositionUpdate", event),
    handleCompositionEnd: (event: any) => dispatchEditorProp("handleCompositionEnd", event),
    handlePaste: (event: any, slice: any) => dispatchEditorProp("handlePaste", event, slice),
    handleInput: (event: any) => dispatchEditorProp("handleInput", event),
    handleCopy: (event: any) => dispatchEditorProp("handleCopy", event),
    handleCut: (event: any) => dispatchEditorProp("handleCut", event),
  };

  const transformCopied = (slice: any) => queryEditorProp("transformCopied", slice) ?? slice;
  const transformCopiedHTML = (html: any, slice: any) =>
    queryEditorProp("transformCopiedHTML", html, slice) ?? html;
  const transformPasted = (slice: any) => queryEditorProp("transformPasted", slice) ?? slice;
  const transformPastedText = (text: any, plain: any) =>
    queryEditorProp("transformPastedText", text, plain) ?? text;
  const transformPastedHTML = (html: any) => queryEditorProp("transformPastedHTML", html) ?? html;
  const clipboardTextSerializer = (slice: any) =>
    queryEditorProp("clipboardTextSerializer", slice) ?? null;
  const serializeSliceToHtmlForClipboard = (slice: any, schema: any) => {
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
  const clipboardTextParser = (text: any, plain: any) => {
    const state = getState();
    const context = state?.selection?.$from ?? null;
    return queryEditorProp("clipboardTextParser", text, context, plain) ?? null;
  };

  return {
    editorHandlers,
    transformCopied,
    transformCopiedHTML,
    transformPasted,
    transformPastedText,
    transformPastedHTML,
    clipboardTextSerializer,
    serializeSliceToHtmlForClipboard,
    clipboardTextParser,
  };
};
