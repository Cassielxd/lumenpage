import { isDragCopy, isEditable, resolveDropSelection } from "./helpers";

export const createInternalDragController = ({
  view,
  state,
  getState,
  getEventCoords,
  getDocPosFromCoords,
  dispatchTransaction,
  setPendingPreferredUpdate,
  setDropDecoration,
  clearDropDecoration,
}: {
  view: any;
  state: any;
  getState: () => any;
  getEventCoords: (event: any) => any;
  getDocPosFromCoords: (coords: any) => any;
  dispatchTransaction: (tr: any) => void;
  setPendingPreferredUpdate: (value: boolean) => void;
  setDropDecoration: (pos: number) => void;
  clearDropDecoration: () => void;
}) => {
  const clearInternalDrag = () => {
    state.clearDragState();
    state.setInternalDragging(false);
  };

  const commitInternalDrop = ({ dropTargetPos, event }: { dropTargetPos: number; event: any }) => {
    const dragState = state.getDragState();
    if (!Number.isFinite(dropTargetPos) || !dragState?.slice) {
      clearInternalDrag();
      clearDropDecoration();
      return false;
    }

    const isCopy = isDragCopy(event);
    const moved = !isCopy;
    const editorState = getState();
    let tr = editorState.tr;

    if (moved) {
      const { from, to } = dragState;
      if (dropTargetPos >= from && dropTargetPos <= to) {
        clearInternalDrag();
        clearDropDecoration();
        return true;
      }
      tr = tr.deleteRange(from, to);
      const mappedPos = tr.mapping.map(dropTargetPos, -1);
      tr = tr.replaceRange(mappedPos, mappedPos, dragState.slice);
      tr = resolveDropSelection(tr, mappedPos, dragState.slice);
    } else {
      tr = tr.replaceRange(dropTargetPos, dropTargetPos, dragState.slice);
      tr = resolveDropSelection(tr, dropTargetPos, dragState.slice);
    }

    setPendingPreferredUpdate(true);
    dispatchTransaction(tr.scrollIntoView());
    clearInternalDrag();
    clearDropDecoration();
    return true;
  };

  const startInternalDragFromSelection = (event: any) => {
    if (!isEditable(view)) {
      return false;
    }
    if (state.isInternalDragging()) {
      return true;
    }
    const editorState = getState?.();
    if (!editorState?.selection || editorState.selection.empty) {
      return false;
    }
    state.setDragState({
      slice: editorState.selection.content(),
      from: editorState.selection.from,
      to: editorState.selection.to,
    });
    state.setInternalDragging(true);
    return true;
  };

  const startInternalDragFromNodePos = (nodePos: number, _event: any) => {
    if (!isEditable(view)) {
      return false;
    }
    if (state.isInternalDragging()) {
      return true;
    }
    if (!Number.isFinite(nodePos)) {
      return false;
    }
    const editorState = getState?.();
    if (!editorState?.doc) {
      return false;
    }
    const docSize = Number(editorState.doc.content?.size ?? 0);
    if (nodePos < 0 || nodePos > docSize) {
      return false;
    }
    let node = null;
    try {
      node = editorState.doc.nodeAt(nodePos);
    } catch (_error) {
      return false;
    }
    if (!editorState?.doc || !node) {
      return false;
    }
    const from = nodePos;
    const to = nodePos + node.nodeSize;
    const slice = editorState.doc.slice(from, to);
    if (!slice || slice.size === 0) {
      return false;
    }
    state.setDragState({ slice, from, to });
    state.setInternalDragging(true);
    return true;
  };

  const updateInternalDrag = (event: any, coords: any) => {
    if (!state.isInternalDragging() || !state.getDragState()) {
      return false;
    }
    const point = coords || getEventCoords(event);
    const nextDropPos = getDocPosFromCoords(point);
    if (Number.isFinite(nextDropPos)) {
      setDropDecoration(nextDropPos);
    } else {
      clearDropDecoration();
    }
    return true;
  };

  const finishInternalDrag = (event: any, coords: any) => {
    if (!state.isInternalDragging() || !state.getDragState()) {
      return false;
    }
    const point = coords || getEventCoords(event);
    const dropTargetPos = getDocPosFromCoords(point);
    if (!Number.isFinite(dropTargetPos)) {
      clearInternalDrag();
      clearDropDecoration();
      return false;
    }
    return commitInternalDrop({ dropTargetPos, event });
  };

  return {
    clearInternalDrag,
    startInternalDragFromSelection,
    startInternalDragFromNodePos,
    updateInternalDrag,
    finishInternalDrag,
    isDragCopy,
    isEditable: () => isEditable(view),
  };
};
