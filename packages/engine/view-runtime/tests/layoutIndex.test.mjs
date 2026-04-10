import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPartialLayoutIndex,
  buildLayoutIndex,
  getBoxesInRange,
  getLineAtOffset,
  getLinesInRange,
  getPageIndexForOffset,
  getTextBoxesInRange,
  getTextLineItemAtOffset,
  getTextLineItemsInRange,
  mergeLayoutIndex,
  resolveStablePageEntryPrefixCount,
} from "../dist/layoutIndex.js";

const createLine = ({ start, end, text, blockId, rootIndex, lineIndex }) => ({
  start,
  end,
  blockStart: start,
  text,
  blockId,
  rootIndex,
  blockType: "paragraph",
  x: 40,
  y: 40 + lineIndex * 26,
  width: Math.max(24, (end - start) * 8),
  lineHeight: 24,
  baseline: 18,
});

const createTextLineBox = (line, lineIndex) => ({
  role: "text-line",
  type: "text-line",
  start: line.start,
  end: line.end,
  x: line.x,
  y: line.y,
  width: line.width,
  height: line.lineHeight,
  blockId: line.blockId,
  meta: {
    lineIndex,
  },
});

const createPage = (index, specs, extra = {}) => {
  const lines = specs.map((spec, lineIndex) =>
    createLine({
      ...spec,
      lineIndex,
    })
  );
  return {
    index,
    lines,
    boxes: lines.map((line, lineIndex) => createTextLineBox(line, lineIndex)),
    fragments: [],
    rootIndexMin: lines.length > 0 ? lines[0].rootIndex : null,
    rootIndexMax: lines.length > 0 ? lines[lines.length - 1].rootIndex : null,
    ...extra,
  };
};

const createLayout = (pages) => ({
  pages,
  pageHeight: 1123,
  pageWidth: 794,
  pageGap: 24,
  totalHeight: pages.length * 1123 + Math.max(0, pages.length - 1) * 24,
});

const serializeLineItem = (item) =>
  item
    ? {
        pageIndex: item.pageIndex,
        lineIndex: item.lineIndex,
        start: item.start,
        end: item.end,
        blockId: item.line?.blockId ?? null,
        text: item.line?.text ?? null,
        boxStart: item.box?.start ?? null,
        boxEnd: item.box?.end ?? null,
      }
    : null;

const serializeBoxItem = (item) =>
  item
    ? {
        pageIndex: item.pageIndex,
        start: item.start,
        end: item.end,
        depth: item.depth,
        role: item.box?.role ?? item.box?.type ?? null,
        blockId: item.box?.blockId ?? null,
        lineIndex: item.box?.meta?.lineIndex ?? null,
      }
    : null;

const serializePageEntry = (entry) => ({
  pageIndex: entry.pageIndex,
  lineCount: entry.lineCount,
  hasOffsetContent: entry.hasOffsetContent,
  startOffset: entry.startOffset,
  endOffset: entry.endOffset,
  pageOffsetDelta: Number.isFinite(entry.page?.__pageOffsetDelta)
    ? Number(entry.page.__pageOffsetDelta)
    : 0,
});

const serializeIndex = (layoutIndex) => ({
  maxOffset: layoutIndex.maxOffset,
  pageIndex: layoutIndex.pageIndex.map((entry) => ({ ...entry })),
  pageEntries: layoutIndex.pageEntries.map(serializePageEntry),
  lines: layoutIndex.lines.map(serializeLineItem),
  boxes: layoutIndex.boxes.map(serializeBoxItem),
  textBoxes: layoutIndex.textBoxes.map(serializeBoxItem),
  textLineItems: layoutIndex.textLineItems.map(serializeLineItem),
  firstLineByBlockId: Array.from(layoutIndex.firstLineByBlockId.entries()).map(([key, value]) => [
    key,
    serializeLineItem(value),
  ]),
  emptyLineByOffset: Array.from(layoutIndex.emptyLineByOffset.entries()).map(([key, value]) => [
    key,
    serializeLineItem(value),
  ]),
});

const createPreviousLayout = () =>
  createLayout([
    createPage(0, [
      { start: 0, end: 5, text: "A0", blockId: "a0", rootIndex: 0 },
      { start: 5, end: 10, text: "A1", blockId: "a1", rootIndex: 1 },
    ]),
    createPage(1, [
      { start: 10, end: 15, text: "B0", blockId: "b0", rootIndex: 2 },
      { start: 15, end: 20, text: "B1", blockId: "b1", rootIndex: 3 },
    ]),
    createPage(2, [
      { start: 20, end: 25, text: "C0", blockId: "c0", rootIndex: 4 },
      { start: 25, end: 30, text: "C1", blockId: "c1", rootIndex: 5 },
    ]),
    createPage(3, [
      { start: 30, end: 35, text: "D0", blockId: "d0", rootIndex: 6 },
      { start: 35, end: 40, text: "D1", blockId: "d1", rootIndex: 7 },
    ]),
  ]);

const createIncrementalLayout = (previousLayout) => {
  const prefixPage = previousLayout.pages[0];
  prefixPage.__reused = true;

  return createLayout([
    prefixPage,
    createPage(1, [
      { start: 10, end: 16, text: "B0+", blockId: "b0", rootIndex: 2 },
      { start: 16, end: 23, text: "B1+", blockId: "b1", rootIndex: 3 },
    ]),
    {
      ...previousLayout.pages[2],
      index: 2,
      __reused: true,
      __sourcePageIndex: 2,
      __pageOffsetDelta: 3,
    },
    {
      ...previousLayout.pages[3],
      index: 3,
      __reused: true,
      __sourcePageIndex: 3,
      __pageOffsetDelta: 3,
    },
  ]);
};

test("incremental layout index matches a full rebuild", () => {
  const previousLayout = createPreviousLayout();
  const previousIndex = buildLayoutIndex(previousLayout);
  assert.ok(previousIndex);

  const previousSnapshot = serializeIndex(previousIndex);
  const nextLayout = createIncrementalLayout(previousLayout);

  const incrementalIndex = buildLayoutIndex(nextLayout, previousIndex, previousLayout);
  const fullIndex = buildLayoutIndex(nextLayout, null, null);

  assert.ok(incrementalIndex);
  assert.ok(fullIndex);
  assert.deepEqual(serializeIndex(incrementalIndex), serializeIndex(fullIndex));
  assert.deepEqual(serializeIndex(previousIndex), previousSnapshot);

  for (let offset = 0; offset <= fullIndex.maxOffset + 2; offset += 1) {
    assert.deepEqual(
      serializeLineItem(getLineAtOffset(incrementalIndex, offset)),
      serializeLineItem(getLineAtOffset(fullIndex, offset))
    );
    assert.deepEqual(
      serializeLineItem(getTextLineItemAtOffset(incrementalIndex, offset)),
      serializeLineItem(getTextLineItemAtOffset(fullIndex, offset))
    );
    assert.equal(getPageIndexForOffset(incrementalIndex, offset), getPageIndexForOffset(fullIndex, offset));
  }

  const ranges = [
    [0, 8],
    [9, 18],
    [18, 28],
    [28, 43],
  ];

  for (const [from, to] of ranges) {
    assert.deepEqual(
      getLinesInRange(incrementalIndex, from, to).map(serializeLineItem),
      getLinesInRange(fullIndex, from, to).map(serializeLineItem)
    );
    assert.deepEqual(
      getBoxesInRange(incrementalIndex, from, to).map(serializeBoxItem),
      getBoxesInRange(fullIndex, from, to).map(serializeBoxItem)
    );
    assert.deepEqual(
      getTextBoxesInRange(incrementalIndex, from, to).map(serializeBoxItem),
      getTextBoxesInRange(fullIndex, from, to).map(serializeBoxItem)
    );
    assert.deepEqual(
      getTextLineItemsInRange(incrementalIndex, from, to).map(serializeLineItem),
      getTextLineItemsInRange(fullIndex, from, to).map(serializeLineItem)
    );
  }
});

test("partial incremental layout index merge matches a full rebuild", () => {
  const previousLayout = createPreviousLayout();
  const previousIndex = buildLayoutIndex(previousLayout);
  assert.ok(previousIndex);

  const nextLayout = createIncrementalLayout(previousLayout);
  const stablePrefixPages = resolveStablePageEntryPrefixCount(
    nextLayout,
    previousLayout,
    previousIndex
  );
  assert.equal(stablePrefixPages, 1);

  const partialIndex = buildPartialLayoutIndex(
    nextLayout,
    stablePrefixPages,
    previousLayout,
    previousIndex
  );
  const mergedIndex = mergeLayoutIndex(previousIndex, partialIndex, stablePrefixPages);
  const fullIndex = buildLayoutIndex(nextLayout, null, null);

  assert.ok(partialIndex);
  assert.ok(mergedIndex);
  assert.ok(fullIndex);
  assert.deepEqual(serializeIndex(mergedIndex), serializeIndex(fullIndex));

  for (let offset = 0; offset <= fullIndex.maxOffset + 2; offset += 1) {
    assert.deepEqual(
      serializeLineItem(getLineAtOffset(mergedIndex, offset)),
      serializeLineItem(getLineAtOffset(fullIndex, offset))
    );
    assert.deepEqual(
      serializeLineItem(getTextLineItemAtOffset(mergedIndex, offset)),
      serializeLineItem(getTextLineItemAtOffset(fullIndex, offset))
    );
    assert.equal(getPageIndexForOffset(mergedIndex, offset), getPageIndexForOffset(fullIndex, offset));
  }

  const ranges = [
    [0, 8],
    [9, 18],
    [18, 28],
    [28, 43],
  ];

  for (const [from, to] of ranges) {
    assert.deepEqual(
      getLinesInRange(mergedIndex, from, to).map(serializeLineItem),
      getLinesInRange(fullIndex, from, to).map(serializeLineItem)
    );
    assert.deepEqual(
      getBoxesInRange(mergedIndex, from, to).map(serializeBoxItem),
      getBoxesInRange(fullIndex, from, to).map(serializeBoxItem)
    );
    assert.deepEqual(
      getTextBoxesInRange(mergedIndex, from, to).map(serializeBoxItem),
      getTextBoxesInRange(fullIndex, from, to).map(serializeBoxItem)
    );
    assert.deepEqual(
      getTextLineItemsInRange(mergedIndex, from, to).map(serializeLineItem),
      getTextLineItemsInRange(fullIndex, from, to).map(serializeLineItem)
    );
  }
});
