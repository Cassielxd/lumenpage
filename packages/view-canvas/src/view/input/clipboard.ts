import { DOMSerializer } from "lumenpage-model";

const defaultSerializeSliceToHtml = (slice, schema, ownerDocument = null) => {
  if (!slice || !schema) {
    return "";
  }
  const docRef = ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!docRef) {
    return "";
  }
  const serializer = DOMSerializer.fromSchema(schema);
  const container = docRef.createElement("div");
  container.appendChild(serializer.serializeFragment(slice.content));
  return container.innerHTML;
};

const writeClipboardData = (event, data) => {
  if (!event?.clipboardData) {
    return false;
  }

  if (typeof data.text === "string") {
    event.clipboardData.setData("text/plain", data.text);
  }
  if (typeof data.html === "string" && data.html.length > 0) {
    event.clipboardData.setData("text/html", data.html);
  }
  if (data.json) {
    event.clipboardData.setData("application/x-lumenpage-slice", JSON.stringify(data.json));
  }

  event.preventDefault();
  return true;
};

export const createClipboardHandlers = ({
  getEditorState,
  getOwnerDocument,
  dispatchTransaction,
  setPendingPreferredUpdate,
  editorHandlers,
  transformCopied,
  clipboardTextSerializer,
  transformCopiedHTML,
  serializeSliceToHtml,
}) => {
  const handleCopy = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (editorHandlers?.handleCopy?.(event)) {
      event.preventDefault();
      return;
    }
    const state = getEditorState?.();
    if (!state?.selection || state.selection.empty) {
      return;
    }

    const selectionSlice = state.selection.content();
    const slice = transformCopied?.(selectionSlice) ?? selectionSlice;
    const serializedText = clipboardTextSerializer?.(slice) ?? null;
    const text = typeof serializedText === "string"
      ? serializedText
      : slice?.content?.textBetween?.(0, slice.content.size, "\n\n") ??
        state.doc.textBetween(state.selection.from, state.selection.to, "\n");
    const rawHtml =
      serializeSliceToHtml?.(slice, state.schema) ??
      defaultSerializeSliceToHtml(slice, state.schema, getOwnerDocument?.());
    const html = typeof transformCopiedHTML === "function" ? transformCopiedHTML(rawHtml, slice) : rawHtml;
    const json = slice?.toJSON?.() ?? null;

    writeClipboardData(event, { text, html, json });
  };

  const handleCut = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (editorHandlers?.handleCut?.(event)) {
      event.preventDefault();
      return;
    }
    const state = getEditorState?.();
    if (!state?.selection || state.selection.empty) {
      return;
    }

    handleCopy(event);

    const tr = state.tr.deleteSelection().scrollIntoView();
    setPendingPreferredUpdate?.(true);
    dispatchTransaction?.(tr);
  };

  return {
    handleCopy,
    handleCut,
  };
};
