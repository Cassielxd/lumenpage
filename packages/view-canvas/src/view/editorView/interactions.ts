import { createPointerHandlers } from "../input/pointerHandlers";
import { createTouchHandlers } from "../input/touchHandlers";
import { getCaretFromPoint } from "../caret";
import { createDragHandlers } from "./drag";
import { NodeSelection } from "lumenpage-state";

// 指针/触摸/拖拽交互装配：保持原有依赖与调用顺序，仅抽离构造体积。
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
}) => {
  const resolveDragNodePosFromEvent = (event) => {
    const fromProps = queryEditorProp?.("resolveDragNodePos", event);
    if (Number.isFinite(fromProps)) {
      return fromProps;
    }
    return null;
  };

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

  const { handlePointerDown, handlePointerMove, handlePointerUp } = createPointerHandlers({
    getLayout,
    scrollArea: dom.scrollArea,
    inputEl: dom.input,
    getText,
    getTextLength,
    posAtCoords,
    getHitAtCoords: (x, y) =>
      getCaretFromPoint(
        getLayout(),
        x,
        y,
        dom.scrollArea.scrollTop,
        dom.scrollArea.clientWidth,
        getTextLength()
      ),
    setSelectionOffsets: (anchor, head, updatePreferred) =>
      setSelectionOffsets(anchor, head, updatePreferred, true),
    setSelectionFromHit,
    setNodeSelectionAtPos,
    getSelectionAnchorOffset,
    getSelectionRangeOffsets,
    isNodeSelectionActive: () => view.state?.selection instanceof NodeSelection,
    setSkipNextClickSelection,
    resolveDragNodePos: resolveDragNodePosFromEvent,
    startInternalDragFromSelection: (event) => dragHandlers.startInternalDragFromSelection(event),
    startInternalDragFromNodePos: (nodePos, event) =>
      dragHandlers.startInternalDragFromNodePos(nodePos, event),
    canStartSelectionDrag: (event) => {
      const selection = view.state?.selection;
      if (selection instanceof NodeSelection) {
        return Number.isFinite(resolveDragNodePosFromEvent(event));
      }
      return true;
    },
    updateInternalDrag: (event, coords) => dragHandlers.updateInternalDrag(event, coords),
    finishInternalDrag: (event, coords) => dragHandlers.finishInternalDrag(event, coords),
    setPreferredX,
  });

  const { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } =
    createTouchHandlers({
      getLayout,
      scrollArea: dom.scrollArea,
      getText,
      getTextLength,
      posAtCoords,
      setSelectionOffsets,
      getSelectionAnchorOffset,
      setPreferredX,
      dispatchEditorProp,
      inputEl: dom.input,
      longPressDelay: settings?.touch?.longPressDelay,
      tapMoveThreshold: settings?.touch?.tapMoveThreshold,
    });

  const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } =
    dragHandlers;

  return {
    pointerHandlers: { handlePointerDown, handlePointerMove, handlePointerUp },
    touchHandlers: { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel },
    dragHandlers,
    domDragHandlers: { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd },
  };
};
