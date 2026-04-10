import { findLineForOffset, getCaretFromPoint, offsetAtX } from "./caret";
import { getFontForOffset, getBaselineOffset, getLineHeight, getLineXForOffset, isVisualBlockLine } from "./textLineGeometry";
import { getFontSize } from "./measure";
import { getPageOffsetDelta, getPageSourcePageIndex, isPageReused } from "./pageRuntimeMeta";
import { getTextLineBoxHitAtPoint, getTextLineOffsetHit } from "./textLineHit";

type LayoutLineItem = {
  pageIndex: number;
  lineIndex: number;
  page: any;
  line: any;
  box?: any;
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

type LayoutTextLineItem = LayoutLineItem & {
  box: any;
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
  textLineItems: LayoutTextLineItem[];
  firstLineByBlockId: Map<string, LayoutLineItem>;
  emptyLineByOffset: Map<number, LayoutLineItem>;
  segmentIndex: Array<{ offset: number; startIdx: number; endIdx: number }>;
  SEGMENT_SIZE: number;
  pageIndex: Array<{ pageIndex: number; startOffset: number; endOffset: number }>;
  pageEntries: LayoutPageEntry[];
};

const SEGMENT_SIZE = 256;

const getRawPageLines = (page: any) => (Array.isArray(page?.lines) ? page.lines : []);

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

const createTextLineItem = (
  pageEntry: LayoutPageEntry,
  line: any,
  lineIndex: number,
  box: any,
  start: number,
  end: number
): LayoutTextLineItem => ({
  ...createLineItem(pageEntry, line, lineIndex),
  start,
  end,
  mid: (start + end) / 2,
  box,
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
  const boxOffsets = scanBoxOffsets(page);
  if (boxOffsets.hasBounds) {
    return {
      lineCount: lines.length,
      hasOffsetContent: true,
      startOffset: boxOffsets.startOffset,
      endOffset: boxOffsets.endOffset,
    };
  }

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
  if (!isPageReused(page) || !previousLayout?.pages || !previousIndex?.pageEntries) {
    return null;
  }

  const sourcePageIndex = Number.isFinite(page?.index) ? Number(page.index) : null;
  const effectiveSourcePageIndex = getPageSourcePageIndex(page) ?? sourcePageIndex;
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

const clonePageEntryForCurrentPage = (
  page: any,
  pageIndex: number,
  sourceEntry: LayoutPageEntry
): LayoutPageEntry => ({
  pageIndex,
  page,
  lineCount: Number.isFinite(sourceEntry?.lineCount)
    ? Number(sourceEntry.lineCount)
    : getRawPageLines(page).length,
  hasOffsetContent: sourceEntry?.hasOffsetContent === true,
  startOffset: Number.isFinite(sourceEntry?.startOffset) ? Number(sourceEntry.startOffset) : 0,
  endOffset: Number.isFinite(sourceEntry?.endOffset) ? Number(sourceEntry.endOffset) : 0,
  sourcePageIndex:
    Number.isFinite(sourceEntry?.sourcePageIndex) ? Number(sourceEntry.sourcePageIndex) : null,
});

const canReusePrefixPageEntry = (
  page: any,
  pageIndex: number,
  previousLayout: any,
  previousIndex: LayoutIndex | null
) => {
  const previousPage = previousLayout?.pages?.[pageIndex];
  const previousEntry = previousIndex?.pageEntries?.[pageIndex];
  if (!page || !previousPage || !previousEntry) {
    return false;
  }
  if (page !== previousPage) {
    return false;
  }
  return getRawPageLines(page).length === previousEntry.lineCount;
};

export const resolveStablePageEntryPrefixCount = (
  layout: any,
  previousLayout: any,
  previousIndex: LayoutIndex | null
) => {
  const maxCount = Math.min(
    layout?.pages?.length ?? 0,
    previousLayout?.pages?.length ?? 0,
    previousIndex?.pageEntries?.length ?? 0
  );
  let count = 0;
  while (
    count < maxCount &&
    canReusePrefixPageEntry(layout.pages[count], count, previousLayout, previousIndex)
  ) {
    count += 1;
  }
  return count;
};

const resolveReusableSuffixStart = (
  layout: any,
  previousLayout: any,
  previousIndex: LayoutIndex | null,
  minStart: number
) => {
  const pages = Array.isArray(layout?.pages) ? layout.pages : [];
  let suffixStart = pages.length;
  for (let pageIndex = pages.length - 1; pageIndex >= minStart; pageIndex -= 1) {
    const reusedEntry = tryReusePageEntry(pages[pageIndex], pageIndex, previousLayout, previousIndex);
    if (!reusedEntry) {
      break;
    }
    suffixStart = pageIndex;
  }
  return suffixStart;
};

const buildPageEntry = (
  page: any,
  pageIndex: number,
  previousLayout: any = null,
  previousIndex: LayoutIndex | null = null
): LayoutPageEntry => {
  const reusedEntry = tryReusePageEntry(page, pageIndex, previousLayout, previousIndex);
  if (reusedEntry) {
    return reusedEntry;
  }
  const offsets = scanPageOffsets(page);
  return {
    pageIndex,
    page,
    lineCount: offsets.lineCount,
    hasOffsetContent: offsets.hasOffsetContent,
    startOffset: offsets.startOffset,
    endOffset: offsets.endOffset,
    sourcePageIndex: null,
  };
};

const buildPageEntriesRange = (
  layout: any,
  startPageIndex: number,
  endPageIndex: number,
  previousLayout: any = null,
  previousIndex: LayoutIndex | null = null
): LayoutPageEntry[] => {
  const pages = Array.isArray(layout?.pages) ? layout.pages : [];
  if (pages.length === 0) {
    return [];
  }

  const safeStart = Math.max(
    0,
    Math.min(Number.isFinite(startPageIndex) ? Number(startPageIndex) : 0, pages.length)
  );
  const safeEnd = Math.max(
    safeStart,
    Math.min(Number.isFinite(endPageIndex) ? Number(endPageIndex) : pages.length, pages.length)
  );
  const pageEntries: LayoutPageEntry[] = [];

  for (let pageIndex = safeStart; pageIndex < safeEnd; pageIndex += 1) {
    pageEntries.push(buildPageEntry(pages[pageIndex], pageIndex, previousLayout, previousIndex));
  }

  return pageEntries;
};

const buildPageEntries = (
  layout: any,
  previousLayout: any = null,
  previousIndex: LayoutIndex | null = null
): LayoutPageEntry[] => {
  if (!layout?.pages?.length) {
    return [];
  }

  const pages = layout.pages;
  const pageEntries: LayoutPageEntry[] = new Array(pages.length);
  const reusablePrefixCount = resolveStablePageEntryPrefixCount(
    layout,
    previousLayout,
    previousIndex
  );
  const reusableSuffixStart = resolveReusableSuffixStart(
    layout,
    previousLayout,
    previousIndex,
    reusablePrefixCount
  );

  for (let pageIndex = 0; pageIndex < reusablePrefixCount; pageIndex += 1) {
    pageEntries[pageIndex] = clonePageEntryForCurrentPage(
      pages[pageIndex],
      pageIndex,
      previousIndex!.pageEntries[pageIndex]
    );
  }

  for (let pageIndex = reusablePrefixCount; pageIndex < reusableSuffixStart; pageIndex += 1) {
    pageEntries[pageIndex] = buildPageEntry(
      pages[pageIndex],
      pageIndex,
      previousLayout,
      previousIndex
    );
  }

  for (let pageIndex = reusableSuffixStart; pageIndex < pages.length; pageIndex += 1) {
    pageEntries[pageIndex] =
      tryReusePageEntry(pages[pageIndex], pageIndex, previousLayout, previousIndex) ??
      buildPageEntry(pages[pageIndex], pageIndex, previousLayout, previousIndex);
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

const buildFlattenedTextLineItems = (pageEntries: LayoutPageEntry[]) => {
  const items: LayoutTextLineItem[] = [];
  const seen = new Set<string>();
  for (const pageEntry of pageEntries) {
    const page = pageEntry.page;
    const pageLines = getPageLines(page);
    const boxes = Array.isArray(page?.boxes) ? page.boxes : [];
    const offsetDelta = getPageOffsetDelta(page);
    walkPageBoxes(
      boxes,
      pageEntry.pageIndex,
      offsetDelta,
      (item) => {
        if (!isTextLineBox(item?.box)) {
          return;
        }
        const lineIndex = Number.isFinite(item?.box?.meta?.lineIndex)
          ? Number(item.box.meta.lineIndex)
          : null;
        if (lineIndex == null) {
          return;
        }
        const line = pageLines[lineIndex];
        if (!line) {
          return;
        }
        const key = `${pageEntry.pageIndex}:${lineIndex}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        items.push(
          createTextLineItem(pageEntry, line, lineIndex, item.box, item.start, item.end)
        );
      },
      0,
      { includeTextLineBoxes: true }
    );
  }
  return items.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    if (a.end !== b.end) {
      return a.end - b.end;
    }
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    return a.lineIndex - b.lineIndex;
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
  defineLazyProperty(layoutIndex as Record<string, any>, "textLineItems", () =>
    buildFlattenedTextLineItems(pageEntries)
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
  const pageEntries = buildPageEntriesRange(
    layout,
    Math.max(0, startPageIndex),
    layout.pages.length,
    previousLayout,
    previousIndex
  );
  return pageEntries.length > 0 ? createLayoutIndex(pageEntries) : null;
};

export const mergeLayoutIndex = (
  existingIndex: LayoutIndex | null,
  newIndex: LayoutIndex | null,
  preservedPageCount: number = 0
): LayoutIndex | null => {
  if (!existingIndex) {
    return newIndex;
  }
  const safePreservedPageCount = Math.max(
    0,
    Math.min(
      Number.isFinite(preservedPageCount) ? Number(preservedPageCount) : 0,
      existingIndex.pageEntries.length
    )
  );
  const preservedEntries = existingIndex.pageEntries
    .filter((entry) => entry.pageIndex < safePreservedPageCount)
    .map((entry) => clonePageEntryForCurrentPage(entry.page, entry.pageIndex, entry));
  const nextEntries = Array.isArray(newIndex?.pageEntries) ? newIndex.pageEntries : [];
  const mergedEntries = preservedEntries.concat(nextEntries);
  return mergedEntries.length > 0 ? createLayoutIndex(mergedEntries) : null;
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

export const getTextLineItemsInRange = (layoutIndex, minOffset, maxOffset) => {
  if (!layoutIndex?.textLineItems?.length) {
    return [];
  }

  const clampedMin = Math.max(0, minOffset);
  const clampedMax = Math.min(maxOffset, layoutIndex.maxOffset);
  if (clampedMin > clampedMax) {
    return [];
  }

  const result: LayoutTextLineItem[] = [];
  for (const item of layoutIndex.textLineItems) {
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

const createLineItemFromTextLineItem = (item: LayoutTextLineItem | null) => {
  if (!item) {
    return null;
  }
  return {
    pageIndex: item.pageIndex,
    lineIndex: item.lineIndex,
    page: item.page,
    line: item.line,
    box: item.box,
    start: item.start,
    end: item.end,
    mid: item.mid,
  };
};

const getTextLineHitAtPoint = (
  layout: any,
  x: number,
  y: number,
  scrollTop: number,
  viewportWidth: number,
  layoutIndex: LayoutIndex
) => {
  const hit = getTextLineBoxHitAtPoint(layout, x, y, scrollTop, viewportWidth, layoutIndex);
  if (!hit) {
    return null;
  }

  const lineItem = createLineItemFromTextLineItem(hit.lineItem);
  if (!lineItem) {
    return null;
  }

  return {
    lineItem,
    page: hit.page,
    pageIndex: hit.pageIndex,
    pageX: hit.pageX,
  };
};

type TextLineOffsetOptions = {
  preferBoundary?: "start" | "end";
};

type TextLineOffsetHit = LayoutTextLineItem & {
  isLineEnd?: boolean;
};

export const getTextLineItemAtOffset = (
  layoutIndex: LayoutIndex,
  offset: number,
  options: TextLineOffsetOptions = {}
): TextLineOffsetHit | null => {
  return getTextLineOffsetHit(layoutIndex, offset, options) as TextLineOffsetHit | null;
};

export const getAdjacentTextLineItem = (
  layoutIndex: LayoutIndex | null,
  offset: number,
  direction: "up" | "down"
): LayoutTextLineItem | null => {
  const items = Array.isArray(layoutIndex?.textLineItems) ? layoutIndex.textLineItems : [];
  if (items.length === 0) {
    return null;
  }

  const current = getTextLineItemAtOffset(layoutIndex as LayoutIndex, offset);
  if (!current) {
    return null;
  }

  const currentIndex = items.findIndex(
    (item) =>
      item.pageIndex === current.pageIndex &&
      item.lineIndex === current.lineIndex &&
      item.start === current.start &&
      item.end === current.end
  );
  if (currentIndex < 0) {
    return null;
  }

  const nextIndex = currentIndex + (direction === "up" ? -1 : 1);
  if (nextIndex < 0 || nextIndex >= items.length) {
    return null;
  }

  return items[nextIndex] ?? null;
};

export const getFirstLineForBlockId = (layoutIndex, blockId) => {
  if (!layoutIndex?.firstLineByBlockId || !blockId) {
    return null;
  }
  return layoutIndex.firstLineByBlockId.get(blockId) || null;
};

export const findLineForOffsetIndexed = (
  layout,
  offset,
  textLength,
  layoutIndex = null,
  options: TextLineOffsetOptions | null = null
) => {
  if (!layoutIndex) {
    return findLineForOffset(layout, offset, textLength, options ?? null);
  }

  const clamped = Math.max(0, Math.min(offset, textLength));
  const textLineHit = getTextLineItemAtOffset(layoutIndex, clamped, options ?? {});
  const hit =
    createLineItemFromTextLineItem(textLineHit) ?? getLineAtOffset(layoutIndex, clamped);
  if (!hit) {
    return findLineForOffset(layout, offset, textLength, {
      ...(options ?? {}),
      layoutIndex,
    });
  }

  return {
    pageIndex: hit.pageIndex,
    lineIndex: hit.lineIndex,
    line: hit.line,
    box: hit.box,
    page: layout?.pages?.[hit.pageIndex] ?? null,
    start: hit.start,
    end: hit.end,
    isLineEnd: textLineHit?.isLineEnd === true,
  };
};

export const getCaretRectIndexed = (
  layout,
  offset,
  scrollTop,
  viewportWidth,
  textLength,
  layoutIndex = null,
  options: TextLineOffsetOptions | null = null
) => {
  if (!layoutIndex) {
    return null;
  }

  const clamped = Math.max(0, Math.min(offset, textLength));
  const textLineHit = getTextLineItemAtOffset(layoutIndex, clamped, options ?? {});
  if (!textLineHit?.line) {
    return null;
  }

  const { pageIndex, page, line, box, start, end } = textLineHit;
  const pageSpan = layout.pageHeight + layout.pageGap;
  const pageTop = pageIndex * pageSpan - scrollTop;
  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const boxX = Number.isFinite(box?.x) ? Number(box.x) : Number(line?.x) || 0;
  const boxY = Number.isFinite(box?.y) ? Number(box.y) : Number(line?.y) || 0;
  const boxWidth = Number.isFinite(box?.width) ? Math.max(0, Number(box.width)) : Math.max(0, Number(line?.width) || 0);
  const boxHeight =
    Number.isFinite(box?.height) && Number(box.height) > 0
      ? Number(box.height)
      : Math.max(1, getLineHeight(line, layout));

  if (isVisualBlockLine(line, page)) {
    const caretX = textLineHit.isLineEnd === true || clamped === end ? boxWidth : 0;
    return {
      x: pageX + boxX + caretX,
      y: pageTop + boxY,
      height: boxHeight,
    };
  }

  const localIndex = Math.max(0, Math.min(clamped - start, String(line?.text || "").length));
  const localX = getLineXForOffset(line, start + localIndex, layout.font, page);
  const caretX =
    textLineHit.isLineEnd === true || clamped === end ? Math.max(localX, boxWidth || localX) : localX;
  const caretFont = getFontForOffset(line, clamped, layout.font, page);
  const fontSize = getFontSize(caretFont);
  const baselineOffset = getBaselineOffset(boxHeight, fontSize);

  return {
    x: pageX + boxX + caretX,
    y: pageTop + boxY + baselineOffset,
    height: fontSize,
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

  const hit = getCaretFromPoint(layout, x, y, scrollTop, viewportWidth, textLength, {
    layoutIndex,
  });
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
    const boxX = Number.isFinite(lineItem?.box?.x) ? Number(lineItem.box.x) : Number(line?.x) || 0;
    const localX = Math.max(0, x - pageX - boxX);
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

  return getCaretFromPoint(layout, x, y, scrollTop, viewportWidth, textLength, {
    layoutIndex,
  });
};
