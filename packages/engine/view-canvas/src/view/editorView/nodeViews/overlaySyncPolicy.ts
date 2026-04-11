import { requiresBoxAnchoredOverlay } from "./overlayGeometryHeuristics.js";

export const canReuseCachedOverlayState = ({
  cached,
  scrollTop,
  viewportWidth,
  layoutVersion,
}: {
  cached: any;
  scrollTop: number;
  viewportWidth: number;
  layoutVersion: number | null;
}) => {
  if (!cached) {
    return false;
  }
  if (
    !Number.isFinite(cached?.x) ||
    !Number.isFinite(cached?.y) ||
    !Number.isFinite(cached?.width) ||
    !Number.isFinite(cached?.height) ||
    !Number.isFinite(cached?.scrollTop) ||
    !Number.isFinite(cached?.viewportWidth)
  ) {
    return false;
  }
  if (Math.abs(Number(viewportWidth) - Number(cached.viewportWidth)) > 1) {
    return false;
  }
  if (
    layoutVersion != null &&
    Number.isFinite(cached?.layoutVersion) &&
    Number(cached.layoutVersion) !== layoutVersion
  ) {
    return false;
  }
  return Math.abs(Number(scrollTop) - Number(cached.scrollTop)) <= Math.max(64, Number(cached.height));
};

export const shouldEmitNodeOverlayTrace = ({
  entry,
  boxRect,
  line,
  visible,
  reason,
}: {
  entry: any;
  boxRect?: any;
  line?: any;
  visible?: boolean;
  reason?: string | null;
}) => {
  const nodeType = String(entry?.node?.type?.name || "");
  if (requiresBoxAnchoredOverlay(entry)) {
    return true;
  }
  if (reason) {
    return true;
  }
  const debugOverlay = boxRect?.debugOverlay ?? null;
  if (!boxRect || !debugOverlay) {
    return true;
  }
  if (visible === true && String(nodeType) !== "paragraph") {
    return true;
  }
  if (
    Number(debugOverlay.directBlockHitCount || 0) !== 1 ||
    Number(debugOverlay.exactRangeHitCount || 0) > 0 ||
    Number(debugOverlay.overlapRangeHitCount || 0) > 0 ||
    Number(debugOverlay.visualBlockTypeHitCount || 0) > 0 ||
    Number(debugOverlay.candidateCount || 0) > 1 ||
    Number(debugOverlay.comparableCandidateCount || 0) > 1 ||
    Number(debugOverlay.chosenSizeMismatch || 0) > 0
  ) {
    return true;
  }
  const entryBlockId = String(entry?.blockId || "");
  const lineBlockId = String(line?.blockId || "");
  const boxBlockId = String(boxRect?.box?.blockId ?? boxRect?.box?.nodeId ?? "");
  if ((lineBlockId && lineBlockId !== entryBlockId) || (boxBlockId && boxBlockId !== entryBlockId)) {
    return true;
  }
  return false;
};
