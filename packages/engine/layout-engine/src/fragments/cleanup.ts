const hasSliceFlags = (line) => {
  const attrs = line?.blockAttrs || {};
  return (
    !!attrs.sliceFromPrev ||
    !!attrs.sliceHasNext ||
    !!attrs.sliceRowSplit
  );
};

const getSliceAnchorKey = (line) => {
  if (!line) {
    return null;
  }
  const attrs = line.blockAttrs || {};
  const sliceGroup =
    typeof attrs.sliceGroup === "string" && attrs.sliceGroup.trim()
      ? attrs.sliceGroup.trim()
      : line.blockType || "block";
  if (Number.isFinite(line.blockStart)) {
    return `${sliceGroup}:start:${Number(line.blockStart)}`;
  }
  if (line.blockId) {
    return `${sliceGroup}:id:${String(line.blockId)}`;
  }
  return null;
};

export const cleanupUnslicedDuplicateSlices = (pages) => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return pages;
  }

  const slicedAnchors = new Set<string>();
  for (const page of pages) {
    for (const line of page?.lines || []) {
      const anchor = getSliceAnchorKey(line);
      if (!anchor) {
        continue;
      }
      if (hasSliceFlags(line)) {
        slicedAnchors.add(anchor);
      }
    }
  }

  if (slicedAnchors.size === 0) {
    return pages;
  }

  for (const page of pages) {
    if (!Array.isArray(page?.lines) || page.lines.length === 0) {
      continue;
    }
    page.lines = page.lines.filter((line) => {
      const anchor = getSliceAnchorKey(line);
      if (!anchor || !slicedAnchors.has(anchor)) {
        return true;
      }
      return hasSliceFlags(line);
    });
  }

  return pages;
};
