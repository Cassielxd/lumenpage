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

export const cleanupUnslicedDuplicateSlices = (
  pages,
  options: { scanUntilPageIndex?: number | null } = {}
) => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return pages;
  }
  const scanUntilPageIndex = Number.isFinite(options?.scanUntilPageIndex)
    ? Math.max(0, Math.min(pages.length - 1, Number(options.scanUntilPageIndex)))
    : pages.length - 1;

  const slicedAnchors = new Set<string>();
  const pageSlicedAnchors = new Map<number, Set<string>>();
  for (let pageIndex = 0; pageIndex <= scanUntilPageIndex; pageIndex += 1) {
    const page = pages[pageIndex];
    const slicedAnchorsOnPage = new Set<string>();
    for (const line of page?.lines || []) {
      const anchor = getSliceAnchorKey(line);
      if (!anchor) {
        continue;
      }
      if (hasSliceFlags(line)) {
        slicedAnchors.add(anchor);
        slicedAnchorsOnPage.add(anchor);
      }
    }
    if (slicedAnchorsOnPage.size > 0) {
      pageSlicedAnchors.set(pageIndex, slicedAnchorsOnPage);
    }
  }

  if (slicedAnchors.size === 0) {
    return pages;
  }

  for (let pageIndex = 0; pageIndex <= scanUntilPageIndex; pageIndex += 1) {
    const page = pages[pageIndex];
    if (!Array.isArray(page?.lines) || page.lines.length === 0) {
      continue;
    }
    const slicedAnchorsOnPage = pageSlicedAnchors.get(pageIndex);
    page.lines = page.lines.filter((line) => {
      const anchor = getSliceAnchorKey(line);
      if (!anchor || !slicedAnchors.has(anchor)) {
        return true;
      }
      if (hasSliceFlags(line)) {
        return true;
      }
      return slicedAnchorsOnPage?.has(anchor) === true;
    });
  }

  return pages;
};
