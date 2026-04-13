import { createDomDragHandlers } from "./drag/domHandlers.js";
import { createDropCursorController } from "./drag/dropCursor.js";
import { createInternalDragController } from "./drag/internalDrag.js";
import { createDragRuntimeState } from "./drag/state.js";

export const createDragHandlers = ({
  view,
  settings,
  scrollArea,
  getLayout,
  getLayoutIndex,
  getText,
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
  scheduleRender,
}: {
  view: any;
  settings: any;
  scrollArea: any;
  getLayout: () => any;
  getLayoutIndex: () => any;
  getText: () => string;
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
  scheduleRender: () => void;
}) => {
  const dragState = createDragRuntimeState();

  const dropCursor = createDropCursorController({
    state: dragState,
    settings,
    getLayout,
    getLayoutIndex,
    getState,
    queryEditorProp,
    scheduleRender,
  });

  const internalDrag = createInternalDragController({
    view,
    state: dragState,
    getState,
    getEventCoords,
    getDocPosFromCoords,
    dispatchTransaction,
    setPendingPreferredUpdate,
    setDropDecoration: dropCursor.setDropDecoration,
    clearDropDecoration: dropCursor.clearDropDecoration,
  });

  const domHandlers = createDomDragHandlers({
    view,
    state: dragState,
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
    setDropDecoration: dropCursor.setDropDecoration,
    clearDropDecoration: dropCursor.clearDropDecoration,
    isEditable: internalDrag.isEditable,
  });

  return {
    ...domHandlers,
    clearDropDecoration: dropCursor.clearDropDecoration,
    getDropDecoration: dropCursor.getDropDecoration,
    startInternalDragFromSelection: internalDrag.startInternalDragFromSelection,
    startInternalDragFromNodePos: internalDrag.startInternalDragFromNodePos,
    updateInternalDrag: internalDrag.updateInternalDrag,
    finishInternalDrag: internalDrag.finishInternalDrag,
    isInternalDragging: dragState.isInternalDragging,
  };
};
