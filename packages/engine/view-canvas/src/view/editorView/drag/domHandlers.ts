import { Slice } from "lumenpage-model";

import { isEditorDomEventHandled } from "../plugins.js";
import { isDragCopy, resolveDraggableNodeRange, resolveDropSelection } from "./helpers.js";

export const createDomDragHandlers = ({
  view,
  state,
  getState,
  getEventCoords,
  getDocPosFromCoords,
  serializeSliceToHtml,
  clipboardTextSerializer,
  createSliceFromText,
  parseHtmlToSlice,
  dispatchEditorProp,
  queryEditorProp,
  dispatchTransaction,
  setPendingPreferredUpdate,
  setDropDecoration,
  clearDropDecoration,
  isEditable,
}: {
  view: any;
  state: any;
  getState: () => any;
  getEventCoords: (event: any) => any;
  getDocPosFromCoords: (coords: any) => any;
  serializeSliceToHtml: (slice: any, schema: any) => string | null;
  clipboardTextSerializer?: (slice: any) => string | null;
  createSliceFromText: (schema: any, text: string) => any;
  parseHtmlToSlice: (html: string) => any;
  dispatchEditorProp?: (name: any, ...args: any[]) => boolean;
  queryEditorProp?: (name: any, ...args: any[]) => any;
  dispatchTransaction: (tr: any) => void;
  setPendingPreferredUpdate: (value: boolean) => void;
  setDropDecoration: (pos: number) => void;
  clearDropDecoration: () => void;
  isEditable: () => boolean;
}) => {
  const clearDragRuntime = () => {
    state.clearDragState();
    state.setInternalDragging(false);
  };

  const handleDragStart = (event: any) => {
    if (!isEditable()) {
      event.preventDefault();
      return;
    }
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    if (dispatchEditorProp?.("handleDragStart", event)) {
      event.preventDefault();
      return;
    }
    const editorState = getState?.();
    if (!editorState?.selection) {
      event.preventDefault();
      return;
    }

    let from = editorState.selection.from;
    let to = editorState.selection.to;
    let slice = editorState.selection.content();

    if (editorState.selection.empty) {
      const fromProps = queryEditorProp?.("resolveDragNodePos", event);
      const nodePos = Number.isFinite(fromProps) ? fromProps : null;
      const range = Number.isFinite(nodePos)
        ? resolveDraggableNodeRange(editorState.doc, nodePos)
        : null;
      if (!range?.node) {
        event.preventDefault();
        return;
      }
      from = range.from;
      to = range.to;
      slice = editorState.doc.slice(from, to);
      if (!slice || slice.size === 0) {
        event.preventDefault();
        return;
      }
    }

    const serializedText = clipboardTextSerializer?.(slice) ?? null;
    const text =
      typeof serializedText === "string"
        ? serializedText
        : editorState.doc.textBetween(from, to, "\n");
    const html = serializeSliceToHtml(slice, editorState.schema);
    const json = slice?.toJSON?.() ?? null;

    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", text);
      if (html) {
        event.dataTransfer.setData("text/html", html);
      }
      if (json) {
        event.dataTransfer.setData("application/x-lumenpage-slice", JSON.stringify(json));
      }
      event.dataTransfer.effectAllowed = "copyMove";
    }

    state.setDragState({ slice, from, to });
  };

  const handleDragOver = (event: any) => {
    if (!isEditable()) {
      event.preventDefault();
      clearDropDecoration();
      return;
    }
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    if (dispatchEditorProp?.("handleDragOver", event)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const coords = getEventCoords(event);
    const nextDropPos = getDocPosFromCoords(coords);
    if (Number.isFinite(nextDropPos)) {
      setDropDecoration(nextDropPos);
    } else {
      clearDropDecoration();
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = isDragCopy(event) ? "copy" : "move";
    }
  };

  const handleDragLeave = (event: any) => {
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    if (dispatchEditorProp?.("handleDragLeave", event)) {
      event.preventDefault();
      return;
    }
    clearDropDecoration();
  };

  const handleDrop = (event: any) => {
    if (!isEditable()) {
      event.preventDefault();
      clearDropDecoration();
      clearDragRuntime();
      return;
    }
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    event.preventDefault();
    clearDropDecoration();

    const coords = getEventCoords(event);
    const editorState = getState();
    const dropTargetPos = getDocPosFromCoords(coords) ?? editorState.selection.head;
    if (!Number.isFinite(dropTargetPos)) {
      clearDragRuntime();
      return;
    }

    const dataTransfer = event.dataTransfer;
    const currentDragState = state.getDragState();
    const copyDrop = isDragCopy(event) || dataTransfer?.dropEffect === "copy";
    const isInternal = !!currentDragState;
    const moved = isInternal && !copyDrop;
    let slice = null;

    if (isInternal && currentDragState?.slice) {
      slice = currentDragState.slice;
    } else if (dataTransfer) {
      const json = dataTransfer.getData("application/x-lumenpage-slice");
      if (json) {
        try {
          slice = Slice.fromJSON(editorState.schema, JSON.parse(json));
        } catch (_error) {
          slice = null;
        }
      }
      if (!slice) {
        const html = dataTransfer.getData("text/html");
        if (html) {
          try {
            slice = parseHtmlToSlice(html);
          } catch (_error) {
            slice = null;
          }
        }
      }
      if (!slice) {
        const text = dataTransfer.getData("text/plain");
        if (text) {
          slice = createSliceFromText(editorState.schema, text);
        }
      }
    }

    if (!slice) {
      clearDragRuntime();
      return;
    }

    if (dispatchEditorProp?.("handleDrop", event, slice, moved)) {
      clearDragRuntime();
      return;
    }

    let tr = editorState.tr;
    if (moved && currentDragState) {
      const { from, to } = currentDragState;
      if (dropTargetPos >= from && dropTargetPos <= to) {
        clearDragRuntime();
        return;
      }
      tr = tr.deleteRange(from, to);
      const mappedPos = tr.mapping.map(dropTargetPos, -1);
      tr = tr.replaceRange(mappedPos, mappedPos, slice);
      tr = resolveDropSelection(tr, mappedPos, slice);
    } else {
      tr = tr.replaceRange(dropTargetPos, dropTargetPos, slice);
      tr = resolveDropSelection(tr, dropTargetPos, slice);
    }

    setPendingPreferredUpdate(true);
    dispatchTransaction(tr.scrollIntoView());
    clearDragRuntime();
  };

  const handleDragEnd = (event: any) => {
    if (event.defaultPrevented || isEditorDomEventHandled(event)) {
      return;
    }
    if (dispatchEditorProp?.("handleDragEnd", event)) {
      event.preventDefault();
      return;
    }
    clearDropDecoration();
    clearDragRuntime();
  };

  return {
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
};
