export const getTextLineBoxHitAtPoint = (
  layout: any,
  x: number,
  y: number,
  scrollTop: number,
  viewportWidth: number,
  layoutIndex: any
) => {
  const textLineItems = Array.isArray(layoutIndex?.textLineItems) ? layoutIndex.textLineItems : [];
  if (textLineItems.length === 0 || !layout?.pages?.length) {
    return null;
  }

  const pageSpan = layout.pageHeight + layout.pageGap;
  const pageIndex = Math.floor((y + scrollTop) / pageSpan);
  if (pageIndex < 0 || pageIndex >= layout.pages.length) {
    return null;
  }

  const page = layout.pages[pageIndex];
  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const localY = y + scrollTop - pageIndex * pageSpan;
  const localPageX = x - pageX;

  let bestHit: any = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const item of textLineItems) {
    if (item.pageIndex !== pageIndex) {
      continue;
    }
    const box = item?.box;
    const top = Number.isFinite(box?.y) ? Number(box.y) : Number.NaN;
    const height = Number.isFinite(box?.height) ? Number(box.height) : 0;
    const bottom = top + Math.max(1, height);
    if (!Number.isFinite(top) || localY < top || localY >= bottom) {
      continue;
    }

    const left = Number.isFinite(box?.x) ? Number(box.x) : 0;
    const width = Number.isFinite(box?.width) ? Number(box.width) : 0;
    const right = left + Math.max(0, width);
    const horizontalDistance =
      localPageX < left ? left - localPageX : localPageX > right ? localPageX - right : 0;
    const centerY = top + Math.max(1, height) / 2;
    const verticalDistance = Math.abs(localY - centerY);
    const score = horizontalDistance * 1000 + verticalDistance;
    if (score < bestScore) {
      bestScore = score;
      bestHit = item;
    }
  }

  if (!bestHit) {
    return null;
  }

  return {
    lineItem: bestHit,
    page,
    pageIndex,
    pageX,
  };
};

export const getTextLineOffsetHit = (
  layoutIndex: any,
  offset: number,
  options: { preferBoundary?: "start" | "end" } = {}
) => {
  const textLineItems = Array.isArray(layoutIndex?.textLineItems) ? layoutIndex.textLineItems : [];
  if (textLineItems.length === 0) {
    return null;
  }

  const preferBoundary = options.preferBoundary === "end" ? "end" : "start";
  let emptyHit: any = null;
  let lineEndHit: any = null;
  let rangeHit: any = null;
  let startHit: any = null;

  for (const item of textLineItems) {
    if (item.start === item.end && offset === item.start && !emptyHit) {
      emptyHit = item;
    }
    if (offset >= item.start && offset < item.end) {
      if (!rangeHit) {
        rangeHit = item;
      }
      if (offset === item.start && !startHit) {
        startHit = item;
      }
    }
    if (offset === item.end && item.end > item.start && !lineEndHit) {
      lineEndHit = {
        ...item,
        isLineEnd: true,
      };
    }
  }

  if (preferBoundary === "end") {
    return lineEndHit ?? rangeHit ?? emptyHit ?? startHit;
  }
  return startHit ?? rangeHit ?? emptyHit ?? lineEndHit;
};

export const getNearestTextLineBoxOnPage = (
  layout: any,
  x: number,
  y: number,
  scrollTop: number,
  viewportWidth: number,
  layoutIndex: any
) => {
  const textLineItems = Array.isArray(layoutIndex?.textLineItems) ? layoutIndex.textLineItems : [];
  if (textLineItems.length === 0 || !layout?.pages?.length) {
    return null;
  }

  const pageSpan = layout.pageHeight + layout.pageGap;
  const pageIndex = Math.floor((y + scrollTop) / pageSpan);
  if (pageIndex < 0 || pageIndex >= layout.pages.length) {
    return null;
  }

  const page = layout.pages[pageIndex];
  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const localY = y + scrollTop - pageIndex * pageSpan;
  const localPageX = x - pageX;

  let bestHit: any = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const item of textLineItems) {
    if (item.pageIndex !== pageIndex) {
      continue;
    }
    const box = item?.box;
    const top = Number.isFinite(box?.y) ? Number(box.y) : Number.NaN;
    const height = Number.isFinite(box?.height) ? Number(box.height) : 0;
    const bottom = top + Math.max(1, height);
    if (!Number.isFinite(top)) {
      continue;
    }

    const left = Number.isFinite(box?.x) ? Number(box.x) : 0;
    const width = Number.isFinite(box?.width) ? Number(box.width) : 0;
    const right = left + Math.max(0, width);
    const horizontalDistance =
      localPageX < left ? left - localPageX : localPageX > right ? localPageX - right : 0;
    const verticalDistance =
      localY < top ? top - localY : localY >= bottom ? localY - bottom : 0;
    const score = verticalDistance * 1000 + horizontalDistance;
    if (score < bestScore) {
      bestScore = score;
      bestHit = item;
    }
  }

  if (!bestHit) {
    return null;
  }

  return {
    lineItem: bestHit,
    page,
    pageIndex,
    pageX,
  };
};
