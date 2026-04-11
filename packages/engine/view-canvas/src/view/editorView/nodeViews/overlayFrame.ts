import { resolveExpectedOverlaySize } from "./overlayGeometryHeuristics.js";

export const resolveCachedOverlayReuseFrame = ({
  cachedOverlayState,
  scrollTop,
  viewportHeight,
}: {
  cachedOverlayState: any;
  scrollTop: number;
  viewportHeight: number;
}) => {
  if (!cachedOverlayState) {
    return null;
  }
  const scrollDelta = scrollTop - Number(cachedOverlayState.scrollTop);
  const y = Number(cachedOverlayState.y) - scrollDelta;
  const height = Number(cachedOverlayState.height);
  return {
    x: cachedOverlayState.x,
    y,
    width: cachedOverlayState.width,
    height,
    visible: y + height > 0 && y < viewportHeight,
    pageIndex: cachedOverlayState.pageIndex ?? null,
  };
};

export const resolveOverlaySyncFrame = ({
  entry,
  item,
  boxRect,
  layout,
  scrollTop,
  viewportWidth,
  viewportHeight,
}: {
  entry: any;
  item?: any;
  boxRect?: any;
  layout: any;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const line = item?.line ?? null;
  const pageSpan = layout.pageHeight + layout.pageGap;
  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageIndex = Number.isFinite(boxRect?.pageIndex) ? Number(boxRect.pageIndex) : item?.pageIndex ?? 0;
  const pageTop = pageIndex * pageSpan - scrollTop;
  const x = boxRect?.x ?? pageX + (line?.x ?? 0);
  const y = boxRect?.y ?? pageTop + (line?.y ?? 0);
  const width =
    boxRect?.width ??
    (Number.isFinite(line?.width)
      ? line.width
      : layout.pageWidth - layout.margin.left - layout.margin.right);
  const height =
    boxRect?.height ?? (Number.isFinite(line?.lineHeight) ? line.lineHeight : layout.lineHeight);
  const expectedSize = resolveExpectedOverlaySize(entry, layout);
  const nextWidth = expectedSize?.width ?? width;
  const nextHeight = expectedSize?.height ?? height;
  return {
    x,
    y,
    width: nextWidth,
    height: nextHeight,
    visible: y + nextHeight > 0 && y < viewportHeight,
    pageIndex,
    line,
    expectedSize,
  };
};
