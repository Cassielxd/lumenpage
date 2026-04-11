import { getNodeViewEntryPos } from "./overlayGeometryHeuristics.js";

export const createOverlayReasonTracePayload = ({
  entry,
  visible,
  reason,
  cachedOverlayState = null,
}: {
  entry: any;
  visible: boolean;
  reason: string;
  cachedOverlayState?: any;
}) => {
  const payload: any = {
    key: entry?.key ?? null,
    blockId: entry?.blockId ?? null,
    nodeType: entry?.node?.type?.name ?? null,
    visible,
    reason,
  };
  if (reason === "reuse-last-box-geometry") {
    payload.cachedLayoutVersion = cachedOverlayState?.layoutVersion ?? null;
    payload.cachedPageIndex = cachedOverlayState?.pageIndex ?? null;
  }
  return payload;
};

export const createOverlayFrameTracePayload = ({
  entry,
  frame,
  boxRect,
}: {
  entry: any;
  frame: any;
  boxRect?: any;
}) => ({
  key: entry?.key ?? null,
  blockId: entry?.blockId ?? null,
  nodeType: entry?.node?.type?.name ?? null,
  entryPos: getNodeViewEntryPos(entry),
  lineBlockId: frame?.line?.blockId ?? null,
  lineBlockType: frame?.line?.blockType ?? null,
  pageIndex: frame?.pageIndex ?? null,
  visible: frame?.visible === true,
  usedBoxRect: !!boxRect,
  x: frame?.x ?? null,
  y: frame?.y ?? null,
  width: frame?.width ?? null,
  height: frame?.height ?? null,
  expectedWidth: frame?.expectedSize?.width ?? null,
  expectedHeight: frame?.expectedSize?.height ?? null,
  fallbackLineWidth: Number.isFinite(frame?.line?.width) ? Number(frame.line.width) : null,
  fallbackLineHeight: Number.isFinite(frame?.line?.lineHeight)
    ? Number(frame.line.lineHeight)
    : null,
  boxKey: boxRect?.box?.key ?? null,
  boxRole: boxRect?.box?.role ?? null,
  boxType: boxRect?.box?.type ?? null,
  boxBlockId: boxRect?.box?.blockId ?? boxRect?.box?.nodeId ?? null,
  boxPageIndex: Number.isFinite(boxRect?.pageIndex) ? Number(boxRect.pageIndex) : null,
  debugOverlay: boxRect?.debugOverlay ?? null,
});
