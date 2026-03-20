import { createDragHandlers } from "./drag";
import { createPointerInteractionHandlers } from "./interactions/pointerPipeline";
import { createInteractionResolvers } from "./interactions/resolvers";
import { createTouchInteractionHandlers } from "./interactions/touchPipeline";

export const createInteractionPipeline = ({
  view,
  settings,
  dom,
  getLayout,
  getLayoutIndex,
  getText,
  getTextLength,
  posAtCoords,
  setSelectionOffsets,
  setSelectionFromHit,
  setNodeSelectionAtPos,
  getSelectionAnchorOffset,
  getSelectionRangeOffsets,
  setSkipNextClickSelection,
  getState,
  setPreferredX,
  getEventCoords,
  getDocPosFromCoords,
  serializeSliceToHtmlForClipboard,
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
  dom: any;
  getLayout: () => any;
  getLayoutIndex: () => any;
  getText: () => string;
  getTextLength: () => number;
  posAtCoords: any;
  setSelectionOffsets: any;
  setSelectionFromHit: any;
  setNodeSelectionAtPos: any;
  getSelectionAnchorOffset: () => any;
  getSelectionRangeOffsets: () => any;
  setSkipNextClickSelection: (value: boolean) => void;
  getState?: () => any;
  setPreferredX: (value: any) => void;
  getEventCoords: (event: any) => any;
  getDocPosFromCoords: (coords: any) => any;
  serializeSliceToHtmlForClipboard: (slice: any, schema: any) => string | null;
  clipboardTextSerializer?: (slice: any) => string | null;
  createSliceFromText: (schema: any, text: string) => any;
  parseHtmlToSlice: (html: string) => any;
  dispatchEditorProp: (name: any, ...args: any[]) => boolean;
  queryEditorProp?: (name: any, ...args: any[]) => any;
  dispatchTransaction: (tr: any) => void;
  setPendingPreferredUpdate: (value: boolean) => void;
  scheduleRender: () => void;
}) => {
  const resolvers = createInteractionResolvers({
    dom,
    getLayout,
    getLayoutIndex,
    getTextLength,
    posAtCoords,
    queryEditorProp,
    getState,
  });

  const dragHandlers = createDragHandlers({
    view,
    settings,
    scrollArea: dom.scrollArea,
    getLayout,
    getLayoutIndex,
    getText,
    getState: () => view.state,
    getEventCoords,
    getDocPosFromCoords,
    serializeSliceToHtml: serializeSliceToHtmlForClipboard,
    clipboardTextSerializer,
    createSliceFromText,
    parseHtmlToSlice,
    dispatchEditorProp,
    queryEditorProp,
    dispatchTransaction,
    setPendingPreferredUpdate,
    scheduleRender,
  });

  const pointerHandlers = createPointerInteractionHandlers({
    view,
    dom,
    getLayout,
    getText,
    getTextLength,
    setSelectionOffsets,
    setSelectionFromHit,
    setNodeSelectionAtPos,
    getSelectionAnchorOffset,
    getSelectionRangeOffsets,
    setSkipNextClickSelection,
    setPreferredX,
    dragHandlers,
    resolvers,
  });

  const touchHandlers = createTouchInteractionHandlers({
    settings,
    dom,
    getLayout,
    getText,
    getTextLength,
    setSelectionOffsets,
    getSelectionAnchorOffset,
    setPreferredX,
    dispatchEditorProp,
    resolvers,
  });

  const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } =
    dragHandlers;

  return {
    pointerHandlers,
    touchHandlers,
    dragHandlers,
    domDragHandlers: { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd },
  };
};
