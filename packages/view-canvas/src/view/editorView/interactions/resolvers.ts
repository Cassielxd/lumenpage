import { getCaretFromPoint } from "../../caret";

export const createInteractionResolvers = ({
  dom,
  getLayout,
  getLayoutIndex,
  getTextLength,
  posAtCoords,
  queryEditorProp,
}: {
  dom: any;
  getLayout: () => any;
  getLayoutIndex: () => any;
  getTextLength: () => number;
  posAtCoords: any;
  queryEditorProp?: (name: any, ...args: any[]) => any;
}) => {
  const resolveOffsetAtCoords = (
    layout: any,
    x: number,
    y: number,
    scrollTop: number,
    clientWidth: number,
    textLength: number
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
      }
    );

  const resolveDragNodePosFromEvent = (event: any) => {
    const fromProps = queryEditorProp?.("resolveDragNodePos", event);
    if (Number.isFinite(fromProps)) {
      return fromProps;
    }
    return null;
  };

  return {
    resolveOffsetAtCoords,
    resolveHitAtCoords,
    resolveDragNodePosFromEvent,
  };
};
