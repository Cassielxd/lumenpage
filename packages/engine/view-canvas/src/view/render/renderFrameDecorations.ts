import { buildDecorationDrawData } from "./decorations.js";
import { handleDecorationWidgetClick } from "./decorationWidgetHitTesting.js";
import { now } from "../debugTrace.js";

type CreateRenderFrameDecorationsArgs = {
  getDecorations?: () => any;
  coordsAtPos: (
    layout: any,
    offset: number,
    scrollTop: number,
    viewportWidth: number,
    textLength: number,
    options?: any
  ) => any;
  docPosToTextOffset: (doc: any, pos: number) => number;
};

export const createRenderFrameDecorations = ({
  getDecorations,
  coordsAtPos,
  docPosToTextOffset,
}: CreateRenderFrameDecorationsArgs) => {
  let lastDecorationData: any | null = null;
  let lastDecorationScrollTop = Number.NaN;
  let lastDecorationViewportWidth = -1;
  let lastDecorationLayoutToken = -1;
  let lastDecorationSource: any = null;

  const shiftDecorationDrawData = (data: any, deltaY: number) => {
    if (!data || !Number.isFinite(deltaY) || deltaY === 0) {
      return data;
    }
    const shiftRects = (rects: any[] | null | undefined) =>
      Array.isArray(rects)
        ? rects.map((rect) => ({
            ...rect,
            y: Number.isFinite(rect?.y) ? Number(rect.y) - deltaY : rect?.y,
          }))
        : [];
    const shiftSegments = (segments: any[] | null | undefined) =>
      Array.isArray(segments)
        ? segments.map((segment) => ({
            ...segment,
            y: Number.isFinite(segment?.y) ? Number(segment.y) - deltaY : segment?.y,
          }))
        : [];
    const shiftWidgets = (widgets: any[] | null | undefined) =>
      Array.isArray(widgets)
        ? widgets.map((widget) => ({
            ...widget,
            y: Number.isFinite(widget?.y) ? Number(widget.y) - deltaY : widget?.y,
          }))
        : [];
    return {
      ...data,
      inlineRects: shiftRects(data.inlineRects),
      nodeRects: shiftRects(data.nodeRects),
      textSegments: shiftSegments(data.textSegments),
      widgets: shiftWidgets(data.widgets),
    };
  };

  const resolveDecorationData = ({
    layout,
    layoutIndex,
    editorState,
    scrollTop,
    viewportWidth,
    textLength,
    layoutToken,
  }: {
    layout: any;
    layoutIndex: any;
    editorState: any;
    scrollTop: number;
    viewportWidth: number;
    textLength: number;
    layoutToken: number;
  }) => {
    const decorationStart = now();
    const decorations = typeof getDecorations === "function" ? getDecorations() : null;
    const canShiftDecorationData =
      decorations === lastDecorationSource &&
      layoutToken === lastDecorationLayoutToken &&
      viewportWidth === lastDecorationViewportWidth &&
      lastDecorationData &&
      Number.isFinite(lastDecorationScrollTop);
    const decorationData = decorations
      ? canShiftDecorationData
        ? shiftDecorationDrawData(lastDecorationData, scrollTop - Number(lastDecorationScrollTop))
        : buildDecorationDrawData(
            {
              layout,
              layoutIndex,
              doc: editorState?.doc,
              decorations,
              scrollTop,
              viewportWidth,
              textLength,
              docPosToTextOffset,
              coordsAtPos,
              layoutToken,
            },
            false
          )
      : null;
    lastDecorationSource = decorations;
    lastDecorationData = decorationData;
    lastDecorationScrollTop = scrollTop;
    lastDecorationViewportWidth = viewportWidth;
    lastDecorationLayoutToken = layoutToken;
    const decorationMs = Math.round((now() - decorationStart) * 100) / 100;
    return {
      decorationData,
      decorationMs,
    };
  };

  return {
    resolveDecorationData,
    handleDecorationClick: ({ view, event, coords }: { view: any; event: any; coords: any }) =>
      handleDecorationWidgetClick({
        view,
        event,
        coords,
        widgets: lastDecorationData?.widgets ?? null,
      }),
  };
};
