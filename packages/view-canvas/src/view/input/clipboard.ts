import { DOMSerializer } from "lumenpage-model";

const serializeSliceToHtml = (slice, schema) => {
  if (!slice || !schema) {
    return "";
  }
  const serializer = DOMSerializer.fromSchema(schema);
  const container = document.createElement("div");
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
  dispatchTransaction,
  setPendingPreferredUpdate,
  editorHandlers,
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

    const slice = state.selection.content();
    const text = state.doc.textBetween(state.selection.from, state.selection.to, "\n");
    const html = serializeSliceToHtml(slice, state.schema);
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
