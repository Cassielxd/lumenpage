import { NodeSelection } from "lumenpage-state";

import { createPointerHandlers } from "../../input/pointerHandlers";

export const createPointerInteractionHandlers = ({
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
}: {
  view: any;
  dom: any;
  getLayout: () => any;
  getText: () => string;
  getTextLength: () => number;
  setSelectionOffsets: (anchor: number, head: number, updatePreferred?: boolean, fromPointer?: boolean) => void;
  setSelectionFromHit: any;
  setNodeSelectionAtPos: any;
  getSelectionAnchorOffset: () => any;
  getSelectionRangeOffsets: () => any;
  setSkipNextClickSelection: (value: boolean) => void;
  setPreferredX: (value: any) => void;
  dragHandlers: any;
  resolvers: {
    resolveOffsetAtCoords: any;
    resolveHitAtCoords: any;
    resolveDragNodePosFromEvent: (event: any) => any;
  };
}) => {
  return createPointerHandlers({
    getLayout,
    scrollArea: dom.scrollArea,
    inputEl: dom.input,
    getText,
    getTextLength,
    posAtCoords: resolvers.resolveOffsetAtCoords,
    getHitAtCoords: resolvers.resolveHitAtCoords,
    setSelectionOffsets: (anchor: number, head: number, updatePreferred: boolean) =>
      setSelectionOffsets(anchor, head, updatePreferred, true),
    setSelectionFromHit,
    setNodeSelectionAtPos,
    getSelectionAnchorOffset,
    getSelectionRangeOffsets,
    isNodeSelectionActive: () => view.state?.selection instanceof NodeSelection,
    setSkipNextClickSelection,
    resolveDragNodePos: resolvers.resolveDragNodePosFromEvent,
    startInternalDragFromSelection: (event: any) => dragHandlers.startInternalDragFromSelection(event),
    startInternalDragFromNodePos: (nodePos: number, event: any) =>
      dragHandlers.startInternalDragFromNodePos(nodePos, event),
    canStartSelectionDrag: (event: any) => {
      const selection = view.state?.selection;
      if (selection instanceof NodeSelection) {
        return Number.isFinite(resolvers.resolveDragNodePosFromEvent(event));
      }
      return true;
    },
    updateInternalDrag: (event: any, coords: any) => dragHandlers.updateInternalDrag(event, coords),
    finishInternalDrag: (event: any, coords: any) => dragHandlers.finishInternalDrag(event, coords),
    setPreferredX,
  });
};
