import { findLineForOffset, getCaretFromPoint, offsetAtX } from "./caret";

type LayoutLineItem = {
  pageIndex: number;
  lineIndex: number;
  page: any;
  line: any;
  start: number;
  end: number;
  mid: number;
};

type LayoutBoxItem = {
  pageIndex: number;
  box: any;
  start: number;
  end: number;
  depth: number;
};

const TEXT_LINE_FRAGMENT_ROLE = "text-line";

const isTextLineBox = (box: any) =>
  String(box?.role || "") === TEXT_LINE_FRAGMENT_ROLE ||
  String(box?.type || "") === TEXT_LINE_FRAGMENT_ROLE;

type LayoutPageEntry = {
  pageIndex: number;
  page: any;
  lineCount: number;
  hasOffsetContent: boolean;
  startOffset: number;
  endOffset: number;
  sourcePageIndex: number | null;
};

export type LayoutIndex = {
  maxOffset: number;
  lines: LayoutLineItem[];
  boxes: LayoutBoxItem[];
  textBoxes: LayoutBoxItem[];
  firstLineByBlockId: Map<string, LayoutLineItem>;
  emptyLineByOffset: Map<number, LayoutLineItem>;
  segmentIndex: Array<{ offset: number; startIdx: number; endIdx: number }>;
  SEGMENT_SIZE: number;
  pageIndex: Array<{ pageIndex: number; startOffset: number; endOffset: number }>;
  pageEntries: LayoutPageEntry[];
};

const SEGMENT_SIZE = 256;

const getRawPageLines = (page: any) => (Array.isArray(page?.lines) ? page.lines : []);

const getPageOffsetDelta = (page: any) =>
  Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0;

const shiftLineForPage = (line: any, offsetDelta: number) => {
  if (!line || !Number.isFinite(offsetDelta) || offsetDelta === 0) {
    return line;
  }
  const next = { ...line };
  if (Number.isFinite(next.start)) {
    next.start += offsetDelta;
  }
  if (Number.isFinite(next.end)) {
    next.end += offsetDelta;
  }
  if (Number.isFinite(next.blockStart)) {
    next.blockStart += offsetDelta;
  }
  next.__offsetDelta =
    (Number.isFinite(line?.__offsetDelta) ? Number(line.__offsetDelta) : 0) + offsetDelta;
  return next;
};

const getPageLines = (page: any) => {
  const lines = getRawPageLines(page);
  const offsetDelta = getPageOffsetDelta(page);
  if (!lines.length || offsetDelta === 0) {
    return lines;
  }
  if (
    Array.isArray(page?.__materializedShiftedLines) &&
    Number(page?.__materializedShiftedLinesDelta) === offsetDelta
  ) {
    return page.__materializedShiftedLines;
  }
  const shiftedLines = lines.map((line: any) => shiftLineForPage(line, offsetDelta));
  page.__materializedShiftedLines = shiftedLines;
  page.__materializedShiftedLinesDelta = offsetDelta;
  return shiftedLines;
};

const walkPageBoxes = (
  boxes: any[],
  pageIndex: number,
  offsetDelta: number,
  visitor: (item: LayoutBoxItem) => void,
  depth = 0,
  options: { includeTextLineBoxes?: boolean } = {}
) => {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    return;
  }
  for (const box of boxes) {
    if (!box) {
      continue;
    }
    const includeTextLineBoxes = options.includeTextLineBoxes === true;
    if (!includeTextLineBoxes && isTextLineBox(box)) {
      continue;
    }
    const start = Number.isFinite(box?.start) ? Number(box.start) + offsetDelta : Number.NaN;
    const end = Number.isFinite(box?.end) ? Number(box.end) + offsetDelta : Number.NaN;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      visitor({
        pageIndex,
        box,
        start,
        end,
        depth,
      });
    }
    if (Array.isArray(box.children) && box.children.length > 0) {
      walkPageBoxes(box.children, pageIndex, offsetDelta, visitor, depth + 1, options);
    }
  }
};

const createLineItem = (pageEntry: LayoutPageEntry, line: any, lineIndex: number): LayoutLineItem => ({
  pageIndex: pageEntry.pageIndex,
  lineIndex,
  page: pageEntry.page,
  line,
  start: Number.isFinite(line?.start) ? Number(line.start) : 0,
  end: Number.isFinite(line?.end) ? Number(line.end) : 0,
  mid:
    Number.isFinite(line?.start) && Number.isFinite(line?.end)
      ? (Number(line.start) + Number(line.end)) / 2
      : 0,
});

const createEmptyMaps = () => ({
  firstLineByBlockId: new Map<string, LayoutLineItem>(),
  emptyLineByOffset: new Map<number, LayoutLineItem>(),
});

const scanBoxOffsets = (page: any) => {
  const boxes = Array.isArray(page?.boxes) ? page.boxes : [];
  const offsetDelta = getPageOffsetDelta(page);
  let startOffset = Number.POSITIVE_INFINITY;
  let endOffset = Number.NEGATIVE_INFINITY;
  walkPageBoxes(boxes, -1, offsetDelta, (item) => {
    startOffset = Math.min(startOffset, item.start);
    endOffset = Math.max(endOffset, item.end);
  });
  return {
    hasBounds: Number.isFinite(startOffset) && Number.isFinite(endOffset),
    startOffset,
    endOffset,
  };
};

const scanPageOffsets = (page: any) => {
  const lines = getPageLines(page);
  let startOffset = Number.POSITIVE_INFINITY;
  let endOffset = Number.NEGATIVE_INFINITY;

  for (const line of lines) {
    if (Number.isFinite(line?.start)) {
      startOffset = Math.min(startOffset, Number(line.start));
    }
    if (Number.isFinite(line?.end)) {
      endOffset = Math.max(endOffset, Number(line.end));
    }
  }

  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) {
    const boxOffsets = scanBoxOffsets(page);
    if (boxOffsets.hasBounds) {
      return {
        lineCount: lines.length,
        hasOffsetContent: true,
        startOffset: boxOffsets.startOffset,
        endOffset: boxOffsets.endOffset,
      };
    }
    return {
      lineCount: lines.length,
      hasOffsetContent: false,
      startOffset: 0,
      endOffset: 0,
    };
  }

  return {
    lineCount: lines.length,
    hasOffsetContent: true,
    startOffset,
    endOffset,
  };
};

const tryReusePageEntry = (
  page: any,
  pageIndex: number,
  previousLayout: any,
  previousIndex: LayoutIndex | null
): LayoutPageEntry | null => {
  if (!page?.__reused || !previousLayout?.pages || !previousIndex?.pageEntries) {
    return null;
  }

  const sourcePageIndex = Number.isFinite(page?.index) ? Number(page.index) : null;
  const effectiveSourcePageIndex =
    Number.isFinite(page?.__sourcePageIndex) ? Number(page.__sourcePageIndex) : sourcePageIndex;
  if (effectiveSourcePageIndex == null || effectiveSourcePageIndex < 0) {
    return null;
  }

  const sourcePage = previousLayout.pages[effectiveSourcePageIndex];
  const sourceEntry = previousIndex.pageEntries[effectiveSourcePageIndex];
  if (!sourcePage || !sourceEntry) {
    return null;
  }

  const nextLines = getRawPageLines(page);
  const sourceLines = getRawPageLines(sourcePage);
  if (nextLines.length !== sourceLines.length) {
    return null;
  }

  const offsetDelta = getPageOffsetDelta(page);
  if (nextLines.length === 0) {
    return {
      pageIndex,
      page,
      lineCount: 0,
      hasOffsetContent: sourceEntry.hasOffsetContent,
      startOffset: sourceEntry.startOffset + offsetDelta,
      endOffset: sourceEntry.endOffset + offsetDelta,
      sourcePageIndex: effectiveSourcePageIndex,
    };
  }

  const sourceFirst = sourceLines[0];
  const sourceLast = sourceLines[sourceLines.length - 1];
  if (
    !Number.isFinite(sourceFirst?.start) ||
    !Number.isFinite(sourceLast?.end)
  ) {
    return null;
  }

  return {
    pageIndex,
    page,
    lineCount: nextLines.length,
    hasOffsetContent: true,
    startOffset: sourceEntry.startOffset + offsetDelta,
    endOffset: sourceEntry.endOffset + offsetDelta,
    sourcePageIndex: effectiveSourcePageIndex,
  };
};

const buildPageEntries = (
  layout: any,
  previousLayout: any = null,
  previousIndex: LayoutIndex | null = null
): LayoutPageEntry[] => {
  if (!layout?.pages?.length) {
    return [];
  }

  const pageEntries: LayoutPageEntry[] = [];
  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const page = layout.pages[pageIndex];
    const reusedEntry = tryReusePageEntry(page, pageIndex, previousLayout, previousIndex);
    if (reusedEntry) {
      pageEntries.push(reusedEntry);
      continue;
    }
    const offsets = scanPageOffsets(page);
    pageEntries.push({
      pageIndex,
      page,
      lineCount: offsets.lineCount,
      hasOffsetContent: offsets.hasOffsetContent,
      startOffset: offsets.startOffset,
      endOffset: offsets.endOffset,
      sourcePageIndex: null,
    });
  }
  return pageEntries;
};

const buildPageIndex = (pageEntries: LayoutPageEntry[]) =>
  pageEntries
    .filter((entry) => entry.hasOffsetContent)
    .map((entry) => ({
      pageIndex: entry.pageIndex,
      startOffset: entry.startOffset,
      endOffset: entry.endOffset,
    }));

const buildFlattenedLines = (pageEntries: LayoutPageEntry[]) => {
  const items: LayoutLineItem[] = [];
  for (const pageEntry of pageEntries) {
    const lines = getPageLines(pageEntry.page);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      items.push(createLineItem(pageEntry, lines[lineIndex], lineIndex));
    }
  }
  return items;
};

const buildFlattenedBoxes = (
  pageEntries: LayoutPageEntry[],
  options: { includeTextLineBoxes?: boolean } = {}
) => {
  const items: LayoutBoxItem[] = [];
  for (const pageEntry of pageEntries) {
    const page = pageEntry.page;
    const boxes = Array.isArray(page?.boxes) ? page.boxes : [];
    const offsetDelta = getPageOffsetDelta(page);
    walkPageBoxes(
      boxes,
      pageEntry.pageIndex,
      offsetDelta,
      (item) => {
        items.push(item);
      },
      0,
      options
    );
  }
  items.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    if (a.end !== b.end) {
      return a.end - b.end;
    }
    return a.depth - b.depth;
  });
  return items;
};

const buildFlattenedTextBoxes = (pageEntries: LayoutPageEntry[]) => {
  const items: LayoutBoxItem[] = [];
  for (const pageEntry of pageEntries) {
    const page = pageEntry.page;
    const boxes = Array.isArray(page?.boxes) ? page.boxes : [];
    const offsetDelta = getPageOffsetDelta(page);
    walkPageBoxes(
      boxes,
      pageEntry.pageIndex,
      offsetDelta,
      (item) => {
        items.push(item);
      },
      0,
      { includeTextLineBoxes: true }
    );
  }
  return items
    .filter((item) => isTextLineBox(item?.box))
    .sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      if (a.end !== b.end) {
        return a.end - b.end;
      }
      return a.depth - b.depth;
    });
};

const buildDerivedMaps = (pageEntries: LayoutPageEntry[]) => {
  const { firstLineByBlockId, emptyLineByOffset } = createEmptyMaps();

  for (const pageEntry of pageEntries) {
    const lines = getPageLines(pageEntry.page);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const item = createLineItem(pageEntry, line, lineIndex);
      const blockId = line?.blockId;
      if (blockId && !firstLineByBlockId.has(blockId)) {
        firstLineByBlockId.set(blockId, item);
      }
      if (item.start === item.end) {
        emptyLineByOffset.set(item.start, item);
      }
    }
  }

  return { firstLineByBlockId, emptyLineByOffset };
};

const defineLazyProperty = (target: Record<string, any>, key: string, factory: () => any) => {
  let value: any;
  let ready = false;
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get() {
      if (!ready) {
        value = factory();
        ready = true;
      }
      return value;
    },
  });
};

const createLayoutIndex = (pageEntries: LayoutPageEntry[]): LayoutIndex => {
  const pageIndex = buildPageIndex(pageEntries);
  const maxOffset =
    pageEntries.length > 0 ? Math.max(0, ...pageEntries.map((entry) => entry.endOffset)) : 0;

  const layoutIndex = {
    maxOffset,
    SEGMENT_SIZE,
    segmentIndex: [],
    pageIndex,
    pageEntries,
  } as LayoutIndex;

  defineLazyProperty(layoutIndex as Record<string, any>, "lines", () => buildFlattenedLines(pageEntries));
  defineLazyProperty(layoutIndex as Record<string, any>, "boxes", () => buildFlattenedBoxes(pageEntries));
  defineLazyProperty(layoutIndex as Record<string, any>, "textBoxes", () =>
    buildFlattenedTextBoxes(pageEntries)
  );
  defineLazyProperty(layoutIndex as Record<string, any>, "firstLineByBlockId", () => {
    const derived = buildDerivedMaps(pageEntries);
    Object.defineProperty(layoutIndex, "emptyLineByOffset", {
      configurable: true,
      enumerable: true,
      value: derived.emptyLineByOffset,
    });
    return derived.firstLineByBlockId;
  });
  defineLazyProperty(layoutIndex as Record<string, any>, "emptyLineByOffset", () => {
    const derived = buildDerivedMaps(pageEntries);
    Object.defineProperty(layoutIndex, "firstLineByBlockId", {
      configurable: true,
      enumerable: true,
      value: derived.firstLineByBlockId,
    });
    return derived.emptyLineByOffset;
  });

  return layoutIndex;
};

const binarySearchClosestLine = (pageEntry: LayoutPageEntry, target: number) => {
  const lines = getPageLines(pageEntry.page);
  if (lines.length === 0) {
    return null;
  }

  let low = 0;
  let high = lines.length - 1;
  let bestIndex = lines.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const line = lines[mid];
    const start = Number.isFinite(line?.start) ? Number(line.start) : 0;
    const end = Number.isFinite(line?.end) ? Number(line.end) : start;
    if (target < start) {
      bestIndex = mid;
      high = mid - 1;
      continue;
    }
    if (target > end) {
      low = mid + 1;
      continue;
    }
    return createLineItem(pageEntry, line, mid);
  }

  return createLineItem(pageEntry, lines[Math.max(0, bestIndex)], Math.max(0, bestIndex));
};

const findPageEntryIndexForOffset = (pageIndex: LayoutIndex["pageIndex"], offset: number) => {
  if (!pageIndex || pageIndex.length === 0) {
    return null;
  }

  let low = 0;
  let high = pageIndex.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const page = pageIndex[mid];
    if (offset < page.startOffset) {
      high = mid - 1;
    } else if (offset > page.endOffset) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  if (low >= pageIndex.length) {
    return pageIndex.length - 1;
  }
  if (high < 0) {
    return 0;
  }

  const lowPage = pageIndex[low];
  const highPage = pageIndex[high];
  const lowDistance = Math.abs(offset - lowPage.startOffset);
  const highDistance = Math.abs(offset - highPage.startOffset);
  return lowDistance <= highDistance ? low : high;
};

export const buildPartialLayoutIndex = (
  layout,
  startPageIndex: number = 0,
  previousLayout: any = null,
  previousIndex: LayoutIndex | null = null
): LayoutIndex | null => {
  if (!layout?.pages?.length) {
    return null;
  }
  const partialLayout = {
    ...layout,
    pages: layout.pages.slice(Math.max(0, startPageIndex)),
  };
  return buildLayoutIndex(partialLayout, previousLayout, previousIndex);
};

export const mergeLayoutIndex = (
  existingIndex: LayoutIndex | null,
  newIndex: LayoutIndex,
  _pageOffset: number = 0
): LayoutIndex => {
  if (!existingIndex) {
    return newIndex;
  }
  return newIndex;
};

export const buildLayoutIndex = (
  layout,
  previousIndex: LayoutIndex | null = null,
  previousLayout: any = null
): LayoutIndex | null => {
  if (!layout) {
    return null;
  }

  const pageEntries = buildPageEntries(layout, previousLayout, previousIndex);
  return createLayoutIndex(pageEntries);
};

export const getLineAtOffset = (layoutIndex, offset) => {
  if (!layoutIndex?.pageEntries?.length) {
    return null;
  }

  const clamped = Math.max(0, Math.min(offset, layoutIndex.maxOffset));
  const pageEntryIndex = findPageEntryIndexForOffset(layoutIndex.pageIndex, clamped);
  if (pageEntryIndex == null) {
    return null;
  }

  const pageInfo = layoutIndex.pageIndex[pageEntryIndex];
  const pageEntry = layoutIndex.pageEntries[pageInfo.pageIndex];
  if (!pageEntry) {
    return null;
  }

  return binarySearchClosestLine(pageEntry, clamped);
};

export const getLinesInRange = (layoutIndex, minOffset, maxOffset) => {
  if (!layoutIndex?.pageEntries?.length) {
    return [];
  }

  const clampedMin = Math.max(0, minOffset);
  const clampedMax = Math.min(maxOffset, layoutIndex.maxOffset);
  if (clampedMin > clampedMax) {
    return [];
  }

  const startIndex = findPageEntryIndexForOffset(layoutIndex.pageIndex, clampedMin);
  const endIndex = findPageEntryIndexForOffset(layoutIndex.pageIndex, clampedMax);
  if (startIndex == null || endIndex == null) {
    return [];
  }

  const result: LayoutLineItem[] = [];
  for (let pageInfoIndex = startIndex; pageInfoIndex <= endIndex; pageInfoIndex += 1) {
    const pageInfo = layoutIndex.pageIndex[pageInfoIndex];
    const pageEntry = layoutIndex.pageEntries[pageInfo.pageIndex];
    if (!pageEntry) {
      continue;
    }

    const lines = getPageLines(pageEntry.page);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const start = Number.isFinite(line?.start) ? Number(line.start) : 0;
      const end = Number.isFinite(line?.end) ? Number(line.end) : start;
      if (end < clampedMin) {
        continue;
      }
      if (start > clampedMax) {
        break;
      }
      result.push(createLineItem(pageEntry, line, lineIndex));
    }
  }

  return result;
};

export const getBoxesInRange = (layoutIndex, minOffset, maxOffset) => {
  if (!layoutIndex?.boxes?.length) {
    return [];
  }

  const clampedMin = Math.max(0, minOffset);
  const clampedMax = Math.min(maxOffset, layoutIndex.maxOffset);
  if (clampedMin > clampedMax) {
    return [];
  }

  const result: LayoutBoxItem[] = [];
  for (const item of layoutIndex.boxes) {
    if (item.end < clampedMin) {
      continue;
    }
    if (item.start > clampedMax) {
      break;
    }
    result.push(item);
  }
  return result;
};

export const getTextBoxesInRange = (layoutIndex, minOffset, maxOffset) => {
  if (!layoutIndex?.textBoxes?.length) {
    return [];
  }

  const clampedMin = Math.max(0, minOffset);
  const clampedMax = Math.min(maxOffset, layoutIndex.maxOffset);
  if (clampedMin > clampedMax) {
    return [];
  }

  const result: LayoutBoxItem[] = [];
  for (const item of layoutIndex.textBoxes) {
    if (item.end < clampedMin) {
      continue;
    }
    if (item.start > clampedMax) {
      break;
    }
    result.push(item);
  }
  return result;
};

const createLineItemFromTextBox = (layoutIndex: LayoutIndex, item: LayoutBoxItem) => {
  const lineIndex = Number.isFinite(item?.box?.meta?.lineIndex)
    ? Number(item.box.meta.lineIndex)
    : null;
  if (lineIndex == null) {
    return null;
  }
  const pageEntry = layoutIndex?.pageEntries?.[item.pageIndex];
  if (!pageEntry) {
    return null;
  }
  const lines = getPageLines(pageEntry.page);
  const line = lines[lineIndex];
  if (!line) {
    return null;
  }
  return createLineItem(pageEntry, line, lineIndex);
};

const getTextLineHitAtPoint = (
  layout: any,
  x: number,
  y: number,
  scrollTop: number,
  viewportWidth: number,
  layoutIndex: LayoutIndex
) => {
  if (!layoutIndex?.textBoxes?.length || !layout?.pages?.length) {
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

  let bestHit: LayoutBoxItem | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const item of layoutIndex.textBoxes) {
    if (item.pageIndex !== pageIndex) {
      continue;
    }
    const box = item.box;
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

  const lineItem = createLineItemFromTextBox(layoutIndex, bestHit);
  if (!lineItem) {
    return null;
  }

  return {
    lineItem,
    page,
    pageIndex,
    pageX,
  };
};

const getTextLineAtOffset = (layoutIndex: LayoutIndex, offset: number) => {
  const hits = getTextBoxesInRange(layoutIndex, offset, offset);
  if (hits.length === 0) {
    return null;
  }

  let rangeHit: LayoutLineItem | null = null;
  let lineEndHit: LayoutLineItem | null = null;
  for (const item of hits) {
    const lineItem = createLineItemFromTextBox(layoutIndex, item);
    if (!lineItem) {
      continue;
    }
    if (offset >= lineItem.start && offset < lineItem.end) {
      rangeHit = lineItem;
      break;
    }
    if (offset === lineItem.end && lineItem.end > lineItem.start && !lineEndHit) {
      lineEndHit = lineItem;
    }
  }

  return rangeHit ?? lineEndHit;
};

export const getFirstLineForBlockId = (layoutIndex, blockId) => {
  if (!layoutIndex?.firstLineByBlockId || !blockId) {
    return null;
  }
  return layoutIndex.firstLineByBlockId.get(blockId) || null;
};

export const findLineForOffsetIndexed = (layout, offset, textLength, layoutIndex = null) => {
  if (!layoutIndex) {
    return findLineForOffset(layout, offset, textLength);
  }

  const clamped = Math.max(0, Math.min(offset, textLength));
  const hit = getTextLineAtOffset(layoutIndex, clamped) ?? getLineAtOffset(layoutIndex, clamped);
  if (!hit) {
    return findLineForOffset(layout, offset, textLength);
  }

  return {
    pageIndex: hit.pageIndex,
    lineIndex: hit.lineIndex,
    line: hit.line,
    page: layout?.pages?.[hit.pageIndex] ?? null,
    start: hit.start,
    end: hit.end,
  };
};

export const offsetAtXIndexed = (layout, line, x, page = null) => offsetAtX(layout.font, line, x, page);

const findPageIndexForOffsetBinary = (pageIndex, offset) => {
  if (!pageIndex || pageIndex.length === 0) {
    return null;
  }

  let low = 0;
  let high = pageIndex.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const page = pageIndex[mid];

    if (offset < page.startOffset) {
      high = mid - 1;
    } else if (offset > page.endOffset) {
      low = mid + 1;
    } else {
      return page.pageIndex;
    }
  }

  if (low >= pageIndex.length) {
    return pageIndex[pageIndex.length - 1]?.pageIndex ?? null;
  }
  if (high < 0) {
    return pageIndex[0]?.pageIndex ?? null;
  }

  const lowPage = pageIndex[low];
  const highPage = pageIndex[high];
  if (!lowPage) {
    return highPage?.pageIndex ?? null;
  }
  if (!highPage) {
    return lowPage?.pageIndex ?? null;
  }

  const distToLow = Math.abs(offset - lowPage.startOffset);
  const distToHigh = Math.abs(highPage.startOffset - offset);

  return distToLow <= distToHigh ? lowPage.pageIndex : highPage.pageIndex;
};

export const getPageIndexForOffset = (layoutIndex, offset) => {
  if (!layoutIndex?.pageIndex?.length) {
    return null;
  }

  return findPageIndexForOffsetBinary(layoutIndex.pageIndex, offset);
};

export const posAtCoordsIndexed = (
  layout,
  x,
  y,
  scrollTop,
  viewportWidth,
  textLength,
  layoutIndex = null
) => {
  if (!layoutIndex) {
    return null;
  }

  const textLineHit = getCaretFromPointIndexed(
    layout,
    x,
    y,
    scrollTop,
    viewportWidth,
    textLength,
    layoutIndex
  );
  if (textLineHit && Number.isFinite(textLineHit.offset)) {
    return textLineHit.offset;
  }

  const hit = getCaretFromPoint(layout, x, y, scrollTop, viewportWidth, textLength);
  if (!hit || !Number.isFinite(hit.offset)) {
    return null;
  }

  return hit.offset;
};

export const getCaretFromPointIndexed = (
  layout,
  x,
  y,
  scrollTop,
  viewportWidth,
  textLength,
  layoutIndex = null
) => {
  if (!layoutIndex) {
    return null;
  }

  const textLineHit = getTextLineHitAtPoint(
    layout,
    x,
    y,
    scrollTop,
    viewportWidth,
    layoutIndex
  );
  if (textLineHit?.lineItem?.line) {
    const { lineItem, page, pageIndex, pageX } = textLineHit;
    const line = lineItem.line;
    const localX = Math.max(0, x - pageX - (Number(line?.x) || 0));
    return {
      offset: offsetAtX(layout.font, line, localX, page),
      localX,
      pageIndex,
      lineIndex: lineItem.lineIndex,
      line,
      page,
      start: lineItem.start,
      end: lineItem.end,
    };
  }

  return getCaretFromPoint(layout, x, y, scrollTop, viewportWidth, textLength);
};
