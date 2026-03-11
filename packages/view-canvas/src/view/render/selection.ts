import { findLineForOffset, offsetAtX, getLinesInRange } from "../caret";
import { measureTextWidth } from "../measure";

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const isImageLine = (line) =>
  line?.imageMeta ||
  line?.blockType === "image" ||
  line?.blockType === "video" ||
  line?.blockType === "horizontalRule";

const getLineOffsetDelta = (line) =>
  Number.isFinite(line?.__offsetDelta) ? Number(line.__offsetDelta) : 0;

const offsetToX = (line, offset, layout) => {
  if (!line.runs || line.runs.length === 0) {
    return measureTextWidth(layout.font, line.text.slice(0, Math.max(0, offset - line.start)));
  }

  let x = 0;
  const lineOffsetDelta = getLineOffsetDelta(line);

  for (const run of line.runs) {
    const runFont = run.font || layout.font;

    const runStart = Number.isFinite(run.start) ? Number(run.start) + lineOffsetDelta : 0;

    const runEnd = Number.isFinite(run.end) ? Number(run.end) + lineOffsetDelta : runStart;

    const runWidth =
      typeof run.width === "number" ? run.width : measureTextWidth(runFont, run.text);

    if (offset <= runStart) {
      return x;
    }

    if (offset >= runEnd) {
      x += runWidth;

      continue;
    }

    const part = run.text.slice(0, offset - runStart);

    x += measureTextWidth(runFont, part);

    return x;
  }

  return x;
};

const getLineMetrics = (layout) => {
  const items = [];
  let maxOffset = 0;
  let totalLines = 0;

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      items.push({
        pageIndex: p,
        lineIndex: l,
        line,
        start: line.start,
        end: line.end,
        mid: (line.start + line.end) / 2,
      });
      totalLines += 1;
      maxOffset = Math.max(maxOffset, line.end ?? 0);
    }
  }

  // Sort by start offset to enable binary search in getLinesInRange
  // This is critical for correct selection rect calculation
  items.sort((a, b) => a.start - b.start);

  return { items, totalLines, maxOffset };
};

export const buildLayoutIndex = (layout) => {
  if (!layout) {
    return null;
  }

  const metrics = getLineMetrics(layout);

  return {
    maxOffset: metrics.maxOffset,
    totalLines: metrics.totalLines,
    lines: metrics.items,
  };
};

const binarySearchClosest = (lines, target) => {
  let low = 0;
  let high = lines.length - 1;
  let best = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = lines[mid];
    if (!item) {
      break;
    }
    if (target < item.start) {
      best = item;
      high = mid - 1;
      continue;
    }
    if (target > item.end) {
      low = mid + 1;
      continue;
    }
    return item;
  }

  if (!best && lines.length > 0) {
    best = lines[lines.length - 1];
  }

  return best;
};

const getPageEntries = (layoutIndex) =>
  Array.isArray(layoutIndex?.pageEntries) ? layoutIndex.pageEntries : null;

const findPageInfoForOffset = (layoutIndex, offset) => {
  const pageIndex = Array.isArray(layoutIndex?.pageIndex) ? layoutIndex.pageIndex : null;
  if (!pageIndex || pageIndex.length === 0) {
    return null;
  }

  let low = 0;
  let high = pageIndex.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = pageIndex[mid];
    if (offset < item.startOffset) {
      high = mid - 1;
      continue;
    }
    if (offset > item.endOffset) {
      low = mid + 1;
      continue;
    }
    return item;
  }

  if (low >= pageIndex.length) {
    return pageIndex[pageIndex.length - 1] ?? null;
  }
  if (high < 0) {
    return pageIndex[0] ?? null;
  }

  const lowItem = pageIndex[low];
  const highItem = pageIndex[high];
  if (!lowItem) {
    return highItem ?? null;
  }
  if (!highItem) {
    return lowItem ?? null;
  }
  return Math.abs(offset - lowItem.startOffset) <= Math.abs(offset - highItem.startOffset)
    ? lowItem
    : highItem;
};

const binarySearchClosestInPage = (pageEntry, target) => {
  const lines = Array.isArray(pageEntry?.page?.lines) ? pageEntry.page.lines : [];
  if (lines.length === 0) {
    return null;
  }

  let low = 0;
  let high = lines.length - 1;
  let best = lines.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const line = lines[mid];
    const start = Number.isFinite(line?.start) ? Number(line.start) : 0;
    const end = Number.isFinite(line?.end) ? Number(line.end) : start;
    if (target < start) {
      best = mid;
      high = mid - 1;
      continue;
    }
    if (target > end) {
      low = mid + 1;
      continue;
    }
    return {
      pageIndex: pageEntry.pageIndex,
      lineIndex: mid,
      line,
      start,
      end,
      mid: (start + end) / 2,
    };
  }

  const lineIndex = Math.max(0, best);
  const line = lines[lineIndex];
  const start = Number.isFinite(line?.start) ? Number(line.start) : 0;
  const end = Number.isFinite(line?.end) ? Number(line.end) : start;
  return {
    pageIndex: pageEntry.pageIndex,
    lineIndex,
    line,
    start,
    end,
    mid: (start + end) / 2,
  };
};

const forEachLineItem = (layout, layoutIndex, visitor) => {
  const pageEntries = getPageEntries(layoutIndex);
  if (pageEntries) {
    for (const pageEntry of pageEntries) {
      const lines = Array.isArray(pageEntry?.page?.lines) ? pageEntry.page.lines : [];
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        visitor({
          pageIndex: pageEntry.pageIndex,
          lineIndex,
          line,
          start: line?.start,
          end: line?.end,
          mid:
            Number.isFinite(line?.start) && Number.isFinite(line?.end)
              ? (Number(line.start) + Number(line.end)) / 2
              : 0,
        });
      }
    }
    return;
  }

  if (layoutIndex?.lines?.length) {
    for (const item of layoutIndex.lines) {
      visitor(item);
    }
    return;
  }

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      visitor({
        pageIndex: p,
        lineIndex: l,
        line,
        start: line?.start,
        end: line?.end,
        mid:
          Number.isFinite(line?.start) && Number.isFinite(line?.end)
            ? (Number(line.start) + Number(line.end)) / 2
            : 0,
      });
    }
  }
};

export const getLineAtOffset = (layoutIndex, offset) => {
  if (!layoutIndex) {
    return null;
  }

  const emptyHit = layoutIndex.emptyLineByOffset?.get?.(offset);
  if (emptyHit) {
    return emptyHit;
  }

  const clamped = Math.max(0, Math.min(offset, layoutIndex.maxOffset));

  const pageEntries = getPageEntries(layoutIndex);
  if (pageEntries?.length) {
    const pageInfo = findPageInfoForOffset(layoutIndex, clamped);
    if (!pageInfo) {
      return null;
    }
    const pageEntry = pageEntries[pageInfo.pageIndex];
    return pageEntry ? binarySearchClosestInPage(pageEntry, clamped) : null;
  }

  if (!layoutIndex.lines || layoutIndex.lines.length === 0) {
    return null;
  }

  return binarySearchClosest(layoutIndex.lines, clamped);
};

export function selectionToRects(
  layout,

  fromOffset,

  toOffset,

  scrollTop,

  viewportWidth,

  textLength,

  layoutIndex = null
) {
  if (!layout || fromOffset === toOffset) {
    return [];
  }

  const minOffset = Math.max(0, Math.min(fromOffset, toOffset));

  const maxOffset = Math.max(
    minOffset,

    Math.min(Math.max(fromOffset, toOffset), textLength)
  );

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);

  const pageSpan = layout.pageHeight + layout.pageGap;

  const rects = [];

  // Use getLinesInRange for O(k) complexity where k = lines in selection range
  if (layoutIndex && typeof getLinesInRange === "function") {
    const linesInRange = getLinesInRange(layoutIndex, minOffset, maxOffset);

    for (const item of linesInRange) {
      const line = item.line;

      const lineStart = line.start;

      const lineEnd = line.end;

      const isEmptyLine = lineStart === lineEnd;
      if (isEmptyLine) {
        if (minOffset > lineStart || maxOffset < lineEnd) {
          return;
        }
      } else if (maxOffset <= lineStart || minOffset >= lineEnd) {
        return;
      }

      const start = Math.max(minOffset, lineStart);

      const end = Math.min(maxOffset, lineEnd);

      const isImage = isImageLine(line);

      const availableWidth = layout.pageWidth - layout.margin.left - layout.margin.right;
      const xStart = isImage ? 0 : offsetToX(line, start, layout);
      let xEnd = isImage
        ? Math.max(xStart, line.width || 0)
        : offsetToX(line, end, layout);
      if (isEmptyLine) {
        xEnd = Math.max(xEnd, line.width || availableWidth);
      }

      const width = Math.max(0, xEnd - xStart);

      if (width <= 0) {
        return;
      }

      rects.push({
        x: pageX + line.x + xStart,

        y: item.pageIndex * pageSpan - scrollTop + line.y,

        width,

        height: getLineHeight(line, layout),
      });
    }

    return rects;
  }

  // Fallback: iterate current layout structure without forcing full index flattening.
  if (layoutIndex) {
    forEachLineItem(layout, layoutIndex, (item) => {
      const line = item.line;

      const lineStart = line.start;

      const lineEnd = line.end;

      const isEmptyLine = lineStart === lineEnd;
      if (isEmptyLine) {
        if (minOffset > lineStart || maxOffset < lineEnd) {
          return;
        }
      } else if (maxOffset <= lineStart || minOffset >= lineEnd) {
        return;
      }

      const start = Math.max(minOffset, lineStart);

      const end = Math.min(maxOffset, lineEnd);

      const isImage = isImageLine(line);

      const availableWidth = layout.pageWidth - layout.margin.left - layout.margin.right;
      const xStart = isImage ? 0 : offsetToX(line, start, layout);
      let xEnd = isImage
        ? Math.max(xStart, line.width || 0)
        : offsetToX(line, end, layout);
      if (isEmptyLine) {
        xEnd = Math.max(xEnd, line.width || availableWidth);
      }

      const width = Math.max(0, xEnd - xStart);

      if (width <= 0) {
        return;
      }

      rects.push({
        x: pageX + line.x + xStart,

        y: item.pageIndex * pageSpan - scrollTop + line.y,

        width,

        height: getLineHeight(line, layout),
      });
    });

    return rects;
  }

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];

    const pageTop = p * pageSpan - scrollTop;

    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];

      const lineStart = line.start;

      const lineEnd = line.end;

      const isEmptyLine = lineStart === lineEnd;
      if (isEmptyLine) {
        if (minOffset > lineStart || maxOffset < lineEnd) {
          continue;
        }
      } else if (maxOffset <= lineStart || minOffset >= lineEnd) {
        continue;
      }

      const start = Math.max(minOffset, lineStart);

      const end = Math.min(maxOffset, lineEnd);

      const isImage = isImageLine(line);

      const availableWidth = layout.pageWidth - layout.margin.left - layout.margin.right;
      const xStart = isImage ? 0 : offsetToX(line, start, layout);
      let xEnd = isImage
        ? Math.max(xStart, line.width || 0)
        : offsetToX(line, end, layout);
      if (isEmptyLine) {
        xEnd = Math.max(xEnd, line.width || availableWidth);
      }

      const width = Math.max(0, xEnd - xStart);

      if (width <= 0) {
        continue;
      }

      rects.push({
        x: pageX + line.x + xStart,

        y: pageTop + line.y,

        width,

        height: getLineHeight(line, layout),
      });
    }
  }

  return rects;
}

const isTableCellSelection = (selection) => {
  const json = selection?.toJSON?.();
  return json?.type === "tableCell";
};

const isTableCellTypeName = (typeName) => typeName === "tableCell" || typeName === "tableHeader";

const resolveTableCellPoint = (doc, pos) => {
  if (!doc || !Number.isFinite(pos)) {
    return null;
  }
  let $pos = null;
  try {
    $pos = doc.resolve(pos);
  } catch (_error) {
    return null;
  }
  let tableDepth = -1;
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    if ($pos.node(depth)?.type?.name === "table") {
      tableDepth = depth;
      break;
    }
  }
  if (tableDepth < 0) {
    return null;
  }
  if (tableDepth + 1 > $pos.depth || $pos.node(tableDepth + 1)?.type?.name !== "tableRow") {
    return null;
  }
  if (tableDepth + 2 > $pos.depth || !isTableCellTypeName($pos.node(tableDepth + 2)?.type?.name)) {
    return null;
  }
  const tableNode = $pos.node(tableDepth);
  const tablePos = $pos.start(tableDepth) - 1;
  return {
    tableNode,
    tablePos,
    rowIndex: $pos.index(tableDepth),
    colIndex: $pos.index(tableDepth + 1),
  };
};

export const tableCellSelectionToRects = ({
  layout,
  selection,
  doc,
  scrollTop,
  viewportWidth,
  layoutIndex,
  docPosToTextOffset,
}) => {
  if (!layout || !selection || !doc || !isTableCellSelection(selection)) {
    return [];
  }
  const anchorPoint = resolveTableCellPoint(doc, selection.anchor);
  const headPoint = resolveTableCellPoint(doc, selection.head);
  if (!anchorPoint || !headPoint) {
    return [];
  }
  if (anchorPoint.tablePos !== headPoint.tablePos) {
    return [];
  }

  const minRow = Math.min(anchorPoint.rowIndex, headPoint.rowIndex);
  const maxRow = Math.max(anchorPoint.rowIndex, headPoint.rowIndex);
  const minCol = Math.min(anchorPoint.colIndex, headPoint.colIndex);
  const maxCol = Math.max(anchorPoint.colIndex, headPoint.colIndex);

  const tableFromPos = anchorPoint.tablePos + 1;
  const tableToPos = anchorPoint.tablePos + anchorPoint.tableNode.nodeSize - 1;
  const tableFromOffset = docPosToTextOffset(doc, tableFromPos);
  const tableToOffset = docPosToTextOffset(doc, tableToPos);
  const offsetMin = Math.min(tableFromOffset, tableToOffset);
  const offsetMax = Math.max(tableFromOffset, tableToOffset);

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageSpan = layout.pageHeight + layout.pageGap;
  const cellMap = new Map();
  forEachLineItem(layout, layoutIndex, (item) => {
    const line = item?.line;
    if (!line || line.blockType !== "table") {
      return;
    }
    const lineStart = Number.isFinite(line.start) ? line.start : null;
    const lineEnd = Number.isFinite(line.end) ? line.end : null;
    if (lineStart != null && lineEnd != null) {
      if (lineEnd < offsetMin || lineStart > offsetMax) {
        return;
      }
    }

    const attrs = line.blockAttrs || {};
    const rowIndex = Number.isFinite(attrs.rowIndex) ? attrs.rowIndex : null;
    const colIndex = Number.isFinite(attrs.colIndex) ? attrs.colIndex : null;
    if (rowIndex == null || colIndex == null) {
      return;
    }
    if (rowIndex < minRow || rowIndex > maxRow || colIndex < minCol || colIndex > maxCol) {
      return;
    }

    const paddingX = Number.isFinite(line.cellPadding)
      ? line.cellPadding
      : Number.isFinite(attrs.padding)
      ? attrs.padding
      : 0;
    const paddingY = Number.isFinite(line.cellPaddingY)
      ? line.cellPaddingY
      : Number.isFinite(attrs.paddingY)
      ? attrs.paddingY
      : 0;
    const lineHeight = getLineHeight(line, layout);
    const contentWidth = Number.isFinite(line.cellWidth)
      ? line.cellWidth
      : Number.isFinite(attrs.colWidth)
      ? attrs.colWidth
      : line.width || 0;
    const cellOuterWidth = Math.max(0, contentWidth + paddingX * 2 + 1);
    const x = pageX + (line.x || 0) - paddingX;
    const y = item.pageIndex * pageSpan - scrollTop + line.y;
    const top = y - paddingY;
    const bottom = y + lineHeight + paddingY;
    const left = x;
    const right = x + cellOuterWidth;
    const key = `${item.pageIndex}:${rowIndex}:${colIndex}`;
    const prev = cellMap.get(key);
    if (!prev) {
      cellMap.set(key, { left, top, right, bottom });
      return;
    }
    prev.left = Math.min(prev.left, left);
    prev.top = Math.min(prev.top, top);
    prev.right = Math.max(prev.right, right);
    prev.bottom = Math.max(prev.bottom, bottom);
  });

  const rects = [];
  for (const entry of cellMap.values()) {
    const width = Math.max(0, entry.right - entry.left);
    const height = Math.max(0, entry.bottom - entry.top);
    if (width <= 0 || height <= 0) {
      continue;
    }
    rects.push({
      x: entry.left,
      y: entry.top,
      width,
      height,
    });
  }
  return rects;
};

export const tableRangeSelectionToCellRects = ({
  layout,
  fromOffset,
  toOffset,
  scrollTop,
  viewportWidth,
  layoutIndex,
}) => {
  if (!layout || !layoutIndex || !Number.isFinite(fromOffset) || !Number.isFinite(toOffset)) {
    return [];
  }
  const minOffset = Math.min(fromOffset, toOffset);
  const maxOffset = Math.max(fromOffset, toOffset);
  if (minOffset === maxOffset) {
    return [];
  }

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageSpan = layout.pageHeight + layout.pageGap;
  const cellMap = new Map();

  forEachLineItem(layout, layoutIndex, (item) => {
    const line = item?.line;
    if (!line || line.blockType !== "table") {
      return;
    }
    const lineStart = Number.isFinite(line.start) ? line.start : null;
    const lineEnd = Number.isFinite(line.end) ? line.end : null;
    if (lineStart == null || lineEnd == null) {
      return;
    }
    const isEmptyLine = lineStart === lineEnd;
    if (isEmptyLine) {
      if (minOffset > lineStart || maxOffset < lineEnd) {
        return;
      }
    } else if (maxOffset <= lineStart || minOffset >= lineEnd) {
      return;
    }
    const attrs = line.blockAttrs || {};
    const rowIndex = Number.isFinite(attrs.rowIndex) ? attrs.rowIndex : null;
    const colIndex = Number.isFinite(attrs.colIndex) ? attrs.colIndex : null;
    if (rowIndex == null || colIndex == null) {
      return;
    }

    const paddingX = Number.isFinite(line.cellPadding)
      ? line.cellPadding
      : Number.isFinite(attrs.padding)
      ? attrs.padding
      : 0;
    const paddingY = Number.isFinite(line.cellPaddingY)
      ? line.cellPaddingY
      : Number.isFinite(attrs.paddingY)
      ? attrs.paddingY
      : 0;
    const lineHeight = getLineHeight(line, layout);
    const contentWidth = Number.isFinite(line.cellWidth)
      ? line.cellWidth
      : Number.isFinite(attrs.colWidth)
      ? attrs.colWidth
      : line.width || 0;
    const cellOuterWidth = Math.max(0, contentWidth + paddingX * 2 + 1);
    const x = pageX + (line.x || 0) - paddingX;
    const y = item.pageIndex * pageSpan - scrollTop + line.y;
    const top = y - paddingY;
    const bottom = y + lineHeight + paddingY;
    const left = x;
    const right = x + cellOuterWidth;
    const blockKey = line.blockId ?? line.blockStart ?? "table";
    const key = `${item.pageIndex}:${blockKey}:${rowIndex}:${colIndex}`;
    const prev = cellMap.get(key);
    if (!prev) {
      cellMap.set(key, { left, top, right, bottom });
      return;
    }
    prev.left = Math.min(prev.left, left);
    prev.top = Math.min(prev.top, top);
    prev.right = Math.max(prev.right, right);
    prev.bottom = Math.max(prev.bottom, bottom);
  });

  const rects = [];
  for (const entry of cellMap.values()) {
    const width = Math.max(0, entry.right - entry.left);
    const height = Math.max(0, entry.bottom - entry.top);
    if (width <= 0 || height <= 0) {
      continue;
    }
    rects.push({
      x: entry.left,
      y: entry.top,
      width,
      height,
    });
  }
  return rects;
};

type ActiveBlockRectOptions = {
  blockTypes?: string[];
  excludeBlockTypes?: string[];
};

export function activeBlockToRects(
  layout,

  offset,

  scrollTop,

  viewportWidth,

  textLength,

  options: ActiveBlockRectOptions = {},

  layoutIndex = null
) {
  if (!layout || !Number.isFinite(offset)) {
    return [];
  }

  const info = layoutIndex ? getLineAtOffset(layoutIndex, offset) : null;
  const resolved = info
    ? { line: info.line, pageIndex: info.pageIndex, lineIndex: info.lineIndex }
    : findLineForOffset(layout, offset, textLength);

  if (!resolved?.line) {
    return [];
  }

  const targetLine = resolved.line;
  const blockType = targetLine.blockType;
  const blockStart = targetLine.blockStart;
  const blockId = targetLine.blockId ?? null;
  const rootIndex = Number.isFinite(targetLine.rootIndex) ? targetLine.rootIndex : null;
  const blockTypes = Array.isArray(options.blockTypes) ? options.blockTypes : null;
  const excludeBlockTypes = Array.isArray(options.excludeBlockTypes)
    ? options.excludeBlockTypes
    : null;

  if (!blockType) {
    return [];
  }
  if (blockTypes && !blockTypes.includes(blockType)) {
    return [];
  }
  if (excludeBlockTypes && excludeBlockTypes.includes(blockType)) {
    return [];
  }

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageSpan = layout.pageHeight + layout.pageGap;
  const rects = [];

  if (layoutIndex) {
    forEachLineItem(layout, layoutIndex, (item) => {
      const line = item.line;

      const matchesBlock =
        rootIndex != null
          ? line.rootIndex === rootIndex
          : blockId != null
          ? line.blockId === blockId
          : blockStart != null
          ? line.blockStart === blockStart && line.blockType === blockType
          : line === targetLine;

      if (!matchesBlock) {
        return;
      }

      const width = Math.max(0, line.width || 0);
      const minWidth = blockType === "paragraph" || blockType === "heading" ? 1 : 0;
      const resolvedWidth = Math.max(width, minWidth);

      if (resolvedWidth <= 0) {
        return;
      }

      rects.push({
        x: pageX + (line.x || 0),

        y: item.pageIndex * pageSpan - scrollTop + line.y,

        width: resolvedWidth,

        height: getLineHeight(line, layout),
      });
    });

    return rects;
  }

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    const pageTop = p * pageSpan - scrollTop;

    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];

      const matchesBlock =
        rootIndex != null
          ? line.rootIndex === rootIndex
          : blockId != null
          ? line.blockId === blockId
          : blockStart != null
          ? line.blockStart === blockStart && line.blockType === blockType
          : line === targetLine;

      if (!matchesBlock) {
        continue;
      }

      const width = Math.max(0, line.width || 0);
      const minWidth = blockType === "paragraph" || blockType === "heading" ? 1 : 0;
      const resolvedWidth = Math.max(width, minWidth);

      if (resolvedWidth <= 0) {
        continue;
      }

      rects.push({
        x: pageX + (line.x || 0),

        y: pageTop + line.y,

        width: resolvedWidth,

        height: getLineHeight(line, layout),
      });
    }
  }

  return rects;
}

export const findLineForOffsetIndexed = (layout, offset, textLength, layoutIndex = null) => {
  if (!layoutIndex) {
    return findLineForOffset(layout, offset, textLength);
  }

  const hit = getLineAtOffset(layoutIndex, offset);
  if (!hit) {
    return findLineForOffset(layout, offset, textLength);
  }

  return {
    pageIndex: hit.pageIndex,
    lineIndex: hit.lineIndex,
    line: hit.line,
  };
};

export const offsetAtXIndexed = (layout, line, x) => offsetAtX(layout.font, line, x);
