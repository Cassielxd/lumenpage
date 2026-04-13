import { getCaretFromPoint } from "../../caret.js";

const resolveClosestNodeViewBlockId = (event: any) => {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") {
    return null;
  }
  return target.closest("[data-node-view-block-id]")?.getAttribute("data-node-view-block-id") || null;
};

const getDocPosByBlockId = (doc: any, blockId: string | null) => {
  if (!doc || !blockId || typeof doc.descendants !== "function") {
    return null;
  }
  let found: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node?.attrs?.id === blockId) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
};

export const createInteractionResolvers = ({
  dom,
  getLayout,
  getLayoutIndex,
  getTextLength,
  posAtCoords,
  queryEditorProp,
  getState,
}: {
  dom: any;
  getLayout: () => any;
  getLayoutIndex: () => any;
  getTextLength: () => number;
  posAtCoords: any;
  queryEditorProp?: (name: any, ...args: any[]) => any;
  getState?: () => any;
}) => {
  const resolveOffsetAtCoords = (
    layout: any,
    x: number,
    y: number,
    scrollTop: number,
    clientWidth: number,
    textLength: number,
  ) =>
    posAtCoords(layout, x, y, scrollTop, clientWidth, textLength, {
      layoutIndex: getLayoutIndex?.() ?? null,
    });

  const resolveHitAtCoords = (x: number, y: number) =>
    getCaretFromPoint(
      getLayout(),
      x,
      y,
      dom.scrollArea.scrollTop,
      dom.scrollArea.clientWidth,
      getTextLength(),
      {
        layoutIndex: getLayoutIndex?.() ?? null,
      },
    );

  const resolveDragNodePosFromEvent = (event: any) => {
    const fromProps = queryEditorProp?.("resolveDragNodePos", event);
    if (Number.isFinite(fromProps)) {
      return fromProps;
    }
    return null;
  };

  const resolveNodeSelectionPosFromEvent = (event: any) => {
    const fromProps = queryEditorProp?.("resolveNodeSelectionPos", event);
    if (Number.isFinite(fromProps)) {
      return fromProps;
    }
    const blockId = resolveClosestNodeViewBlockId(event);
    if (!blockId) {
      return null;
    }
    return getDocPosByBlockId(getState?.()?.doc, blockId);
  };

  return {
    resolveOffsetAtCoords,
    resolveHitAtCoords,
    resolveDragNodePosFromEvent,
    resolveNodeSelectionPosFromEvent,
  };
};
