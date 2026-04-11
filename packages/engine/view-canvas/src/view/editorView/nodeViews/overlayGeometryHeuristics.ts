const TEXT_LINE_FRAGMENT_ROLE = "text-line";

const VISUAL_BLOCK_NODE_TYPES = new Set([
  "image",
  "video",
  "audio",
  "embedPanel",
  "file",
  "bookmark",
  "signature",
  "webPage",
]);

const readPositiveDimension = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

export const isTextLineBox = (box: any) =>
  String(box?.role || "") === TEXT_LINE_FRAGMENT_ROLE ||
  String(box?.type || "") === TEXT_LINE_FRAGMENT_ROLE;

export const hasVisualBlockCapability = (box: any) => {
  const capabilities = box?.layoutCapabilities ?? box?.blockAttrs?.layoutCapabilities;
  return capabilities?.["visual-block"] === true;
};

export const getOverlayRectArea = (rect: any) =>
  Math.max(1, Number(rect?.width || 0) * Number(rect?.height || 0));

const compareNodeViewBoxCandidate = (next: any, best: any) => {
  if (!best) {
    return true;
  }
  const nextVisualSizeScore = next.visualBlock ? next.sizeMismatch : Number.POSITIVE_INFINITY;
  const bestVisualSizeScore = best.visualBlock ? best.sizeMismatch : Number.POSITIVE_INFINITY;
  if (nextVisualSizeScore !== bestVisualSizeScore) {
    return nextVisualSizeScore < bestVisualSizeScore;
  }
  if (next.visibleOverlap !== best.visibleOverlap) {
    return next.visibleOverlap > best.visibleOverlap;
  }
  if (next.distanceToViewport !== best.distanceToViewport) {
    return next.distanceToViewport < best.distanceToViewport;
  }
  if (next.sizeMismatch !== best.sizeMismatch) {
    return next.sizeMismatch < best.sizeMismatch;
  }
  if (next.visualBlock !== best.visualBlock) {
    return next.visualBlock;
  }
  if (next.depth !== best.depth) {
    return next.depth < best.depth;
  }
  if (next.area !== best.area) {
    return next.area > best.area;
  }
  return false;
};

export const requiresBoxAnchoredOverlay = (entry: any) =>
  VISUAL_BLOCK_NODE_TYPES.has(String(entry?.node?.type?.name || ""));

export const getNodeViewEntryPos = (entry: any) => {
  const livePos = entry?.getPos?.();
  if (Number.isFinite(livePos)) {
    return Number(livePos);
  }
  return Number.isFinite(entry?.pos) ? Number(entry.pos) : null;
};

export const resolveExpectedOverlaySize = (entry: any, layout: any) => {
  const attrs = entry?.node?.attrs ?? null;
  const rawWidth = readPositiveDimension(attrs?.width);
  const rawHeight = readPositiveDimension(attrs?.height);
  if (!rawWidth || !rawHeight) {
    return null;
  }
  const pageWidth = readPositiveDimension(layout?.pageWidth);
  const marginLeft = readPositiveDimension(layout?.margin?.left) ?? 0;
  const marginRight = readPositiveDimension(layout?.margin?.right) ?? 0;
  const maxWidth =
    pageWidth != null ? Math.max(1, pageWidth - marginLeft - marginRight) : rawWidth;
  const width = Math.min(rawWidth, maxWidth);
  const height = rawHeight;
  return { width, height };
};

export const chooseBestNodeViewBoxCandidate = ({
  candidates,
  expectedSize,
}: {
  candidates: any[];
  expectedSize: any;
}) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      best: null,
      comparableCandidates: [],
    };
  }

  const comparableCandidates =
    expectedSize == null
      ? candidates
      : (() => {
          const minMismatch = Math.min(...candidates.map((candidate) => candidate.sizeMismatch));
          const sizeMatchedCandidates = candidates.filter(
            (candidate) => candidate.sizeMismatch <= minMismatch + 4,
          );
          return sizeMatchedCandidates.length > 0 ? sizeMatchedCandidates : candidates;
        })();

  let best = null;
  for (const candidate of comparableCandidates) {
    if (compareNodeViewBoxCandidate(candidate, best)) {
      best = {
        ...candidate,
      };
    }
  }

  return {
    best,
    comparableCandidates,
  };
};
