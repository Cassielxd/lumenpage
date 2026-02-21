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
  posAtCoords,
  setSelectionOffsets,
  setSelectionFromHit,
  setNodeSelectionAtPos,
  setGapCursorAtCoords,
  resolveNodeSelectionTarget,
  resolveGapSelectionAtPos,
  getSelectionAnchorOffset,
  getSelectionRangeOffsets,
  setSkipNextClickSelection,
  getState,
  setPreferredX,
  textOffsetToDocPos,
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
    const fallbackTarget = event?.target?.closest?.("[data-lumen-drag-pos]");
    const fallbackAttr = fallbackTarget?.getAttribute?.("data-lumen-drag-pos");
    const fallbackPos = Number(fallbackAttr);
    return Number.isFinite(fallbackPos) ? fallbackPos : null;
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
    posAtCoords,
    getHitAtCoords: (x, y) =>
      getCaretFromPoint(
        getLayout(),
        x,
        y,
        dom.scrollArea.scrollTop,
        dom.scrollArea.clientWidth,
        getText().length
      ),
    setSelectionOffsets: (anchor, head, updatePreferred) =>
      setSelectionOffsets(anchor, head, updatePreferred, true),
    setSelectionFromHit,
    setNodeSelectionAtPos,
    setGapCursorAtCoords,
    shouldDeferSelection: (hit, hitOffset) => {
      if (!getLayout() || !Number.isFinite(hitOffset) || view.editable === false) {
        return false;
      }
      if (resolveNodeSelectionTarget(hit)) {
        return false;
      }
      const pos = textOffsetToDocPos(view.state.doc, hitOffset);
      if (!Number.isFinite(pos)) {
        return false;
      }
      return !!resolveGapSelectionAtPos(pos);
    },
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
