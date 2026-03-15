export const hasLegacyVisualBlockData = (line) =>
  !!line?.imageMeta || !!line?.videoMeta || line?.blockType === "horizontalRule";

export const resolveLegacyOwnerX = ({ line, blockAttrs, fallbackX = null }) => {
  if (Number.isFinite(blockAttrs?.codeBlockOuterX)) {
    return Number(blockAttrs.codeBlockOuterX);
  }
  if (hasLegacyVisualBlockData(line) && Number.isFinite(line?.x)) {
    return Number(line.x);
  }
  return Number.isFinite(fallbackX) ? Number(fallbackX) : undefined;
};

export const resolveLegacyOwnerWidth = ({ line, blockAttrs, fallbackWidth = null }) => {
  if (Number.isFinite(blockAttrs?.codeBlockOuterWidth)) {
    return Math.max(0, Number(blockAttrs.codeBlockOuterWidth));
  }
  if (Number.isFinite(line?.imageMeta?.width)) {
    return Math.max(0, Number(line.imageMeta.width));
  }
  if (Number.isFinite(line?.videoMeta?.width)) {
    return Math.max(0, Number(line.videoMeta.width));
  }
  if (line?.blockType === "horizontalRule" && Number.isFinite(line?.width)) {
    return Math.max(0, Number(line.width));
  }
  return Number.isFinite(fallbackWidth) ? Math.max(0, Number(fallbackWidth)) : undefined;
};

export const resolveLegacyOwnerMeta = ({ line, blockAttrs }) => {
  const meta: Record<string, unknown> = {};
  if (typeof blockAttrs?.codeBlockBackground === "string") {
    meta.codeBlockBackground = blockAttrs.codeBlockBackground;
  }
  if (typeof blockAttrs?.codeBlockBorderColor === "string") {
    meta.codeBlockBorderColor = blockAttrs.codeBlockBorderColor;
  }
  if (line?.imageMeta && typeof line.imageMeta === "object") {
    meta.alt = line.imageMeta.alt || "";
  }
  return meta;
};
