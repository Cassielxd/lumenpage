const getRectArea = (rect: any) =>
  Math.max(1, Number(rect?.width || 0) * Number(rect?.height || 0));

export const findBoxAnchoredNodeViewEntryAtCoords = ({
  entries,
  coords,
  layout,
  layoutIndex,
  scrollTop,
  viewportWidth,
  viewportHeight,
  doc,
  resolveNodeViewBoxRect,
}: {
  entries: Iterable<any>;
  coords: any;
  layout: any;
  layoutIndex: any;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
  doc: any;
  resolveNodeViewBoxRect: (args: {
    entry: any;
    layout: any;
    layoutIndex: any;
    scrollTop: number;
    viewportWidth: number;
    viewportHeight: number;
    doc: any;
  }) => any;
}) => {
  if (!layout || !layoutIndex || !doc) {
    return null;
  }
  let bestBoxEntry = null;
  let bestBoxArea = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    const rect = resolveNodeViewBoxRect({
      entry,
      layout,
      layoutIndex,
      scrollTop,
      viewportWidth,
      viewportHeight,
      doc,
    });
    if (!rect) {
      continue;
    }
    const withinX = coords.x >= rect.x && coords.x <= rect.x + rect.width;
    const withinY = coords.y >= rect.y && coords.y <= rect.y + rect.height;
    if (!withinX || !withinY) {
      continue;
    }
    const area = getRectArea(rect);
    if (!bestBoxEntry || area <= bestBoxArea) {
      bestBoxEntry = entry;
      bestBoxArea = area;
    }
  }
  return bestBoxEntry;
};

export const resolveNodeViewEntryAtCoords = ({
  entries,
  nodeViewsByBlockId,
  coords,
  getDocPosFromCoords,
  docPosToTextOffset,
  getPreferredBlockIdFromLine,
  getLineAtOffset,
  layout,
  layoutIndex,
  scrollTop,
  viewportWidth,
  viewportHeight,
  doc,
  resolveNodeViewBoxRect,
  findNodeViewEntryAtDocPos,
}: {
  entries: Iterable<any>;
  nodeViewsByBlockId: Map<string, any>;
  coords: any;
  getDocPosFromCoords: (coords: any) => any;
  docPosToTextOffset: (doc: any, pos: number) => number;
  getPreferredBlockIdFromLine: (line: any) => any;
  getLineAtOffset: (layoutIndex: any, offset: number) => any;
  layout: any;
  layoutIndex: any;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
  doc: any;
  resolveNodeViewBoxRect: (args: {
    entry: any;
    layout: any;
    layoutIndex: any;
    scrollTop: number;
    viewportWidth: number;
    viewportHeight: number;
    doc: any;
  }) => any;
  findNodeViewEntryAtDocPos: (args: {
    entries: Iterable<any>;
    nodeViewsByBlockId: Map<string, any>;
    pos: number;
    docPosToTextOffset: (doc: any, pos: number) => number;
    getPreferredBlockIdFromLine: (line: any) => any;
    getLineAtOffset: (layoutIndex: any, offset: number) => any;
    layoutIndex: any;
    doc: any;
  }) => any;
}) => {
  if (!layoutIndex || !doc) {
    return null;
  }

  const boxEntry = findBoxAnchoredNodeViewEntryAtCoords({
    entries,
    coords,
    layout,
    layoutIndex,
    scrollTop,
    viewportWidth,
    viewportHeight,
    doc,
    resolveNodeViewBoxRect,
  });
  if (boxEntry) {
    return boxEntry;
  }

  const pos = getDocPosFromCoords(coords);
  if (!Number.isFinite(pos)) {
    return null;
  }
  return findNodeViewEntryAtDocPos({
    entries,
    nodeViewsByBlockId,
    pos,
    docPosToTextOffset,
    getPreferredBlockIdFromLine,
    getLineAtOffset,
    layoutIndex,
    doc,
  });
};
