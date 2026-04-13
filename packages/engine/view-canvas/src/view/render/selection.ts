import { findLineForOffset, offsetAtX } from "../caret.js";
import { getPageOffsetDelta as readPageOffsetDelta } from "../layoutRuntimeMetadata.js";
import {
  buildLayoutIndex as runtimeBuildLayoutIndex,
  findLineForOffsetIndexed as runtimeFindLineForOffsetIndexed,
  getLineAtOffset as runtimeGetLineAtOffset,
  getLinesInRange as runtimeGetLinesInRange,
  getTextLineItemsInRange as runtimeGetTextLineItemsInRange,
} from "../layoutIndex.js";
import {
  findNearestLineOwnerWithCapability,
  hasLayoutCapability,
  isLineVisualBlock,
  isTableLayoutLine,
} from "../layoutSemantics.js";
import { measureTextWidth } from "../measure.js";
import {
  matchesTableSelectionNodeType,
  normalizeTableSelectionSemantics,
  type TableSelectionSemantics,
} from "../tableSelectionSemantics.js";
import {
  collectAllLayoutBoxesForRange,
  collectTextLineItemsForRange,
  resolveEmptyLineWidth,
  resolveLayoutBoxRect,
  resolveLineVisualBox,
} from "./geometry.js";

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const getLineOffsetDelta = (line) =>
  Number.isFinite(line?.__offsetDelta) ? Number(line.__offsetDelta) : 0;

const getPageOffsetDelta = (page) => readPageOffsetDelta(page);

const getRunOffsetDelta = (line, page = null) => getLineOffsetDelta(line) + getPageOffsetDelta(page);

const TEXT_LINE_FRAGMENT_ROLE = "text-line";

const isTextLineBox = (box) =>
  String(box?.role || "") === TEXT_LINE_FRAGMENT_ROLE ||
  String(box?.type || "") === TEXT_LINE_FRAGMENT_ROLE;

const getLineStart = (line, page = null) =>
  Number.isFinite(line?.start) ? Number(line.start) + getPageOffsetDelta(page) : 0;

const getLineEnd = (line, page = null) => {
  const start = getLineStart(line, page);
  return Number.isFinite(line?.end) ? Number(line.end) + getPageOffsetDelta(page) : start;
};

const getLineBlockStart = (line, page = null) => {
  if (Number.isFinite(line?.blockStart)) {
    return Number(line.blockStart) + getPageOffsetDelta(page);
  }
  return getLineStart(line, page);
};

const offsetToX = (line, offset, layout, page = null) => {
  const lineStart = getLineStart(line, page);
  if (!line.runs || line.runs.length === 0) {
    return measureTextWidth(layout.font, line.text.slice(0, Math.max(0, offset - lineStart)));
  }

  let x = 0;
  const lineOffsetDelta = getRunOffsetDelta(line, page);

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

export const buildLayoutIndex = (layout, previousIndex = null, previousLayout = null) => {
  if (!layout) {
    return null;
  }
  return runtimeBuildLayoutIndex(layout, previousIndex, previousLayout);
};

const getPageEntries = (layoutIndex) =>
  Array.isArray(layoutIndex?.pageEntries) ? layoutIndex.pageEntries : null;

const forEachLineItem = (layout, layoutIndex, visitor) => {
  const pageEntries = getPageEntries(layoutIndex);
  if (pageEntries) {
    for (const pageEntry of pageEntries) {
      const lines = Array.isArray(pageEntry?.page?.lines) ? pageEntry.page.lines : [];
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const start = getLineStart(line, pageEntry.page);
        const end = getLineEnd(line, pageEntry.page);
        visitor({
          pageIndex: pageEntry.pageIndex,
          lineIndex,
          line,
          start,
          end,
          mid: (start + end) / 2,
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
      const start = getLineStart(line, page);
      const end = getLineEnd(line, page);
      visitor({
        pageIndex: p,
        lineIndex: l,
        line,
        start,
        end,
        mid: (start + end) / 2,
      });
    }
  }
};

const mergeTextLineCandidates = (lineItems, textLineItems) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return Array.isArray(textLineItems) ? textLineItems : [];
  }
  if (!Array.isArray(textLineItems) || textLineItems.length === 0) {
    return lineItems;
  }
  const textItemMap = new Map();
  for (const item of textLineItems) {
    const key = `${Number(item?.pageIndex) || 0}:${Number(item?.lineIndex) || 0}`;
    textItemMap.set(key, item);
  }
  return lineItems.map((item) => {
    const key = `${Number(item?.pageIndex) || 0}:${Number(item?.lineIndex) || 0}`;
    const textItem = textItemMap.get(key);
    if (!textItem) {
      return item;
    }
    return {
      ...item,
      ...textItem,
      line: textItem.line,
      page: textItem.page ?? item.page ?? null,
    };
  });
};

const walkPageBoxes = (boxes, pageIndex, offsetDelta, visitor, depth = 0) => {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    return;
  }
  for (const box of boxes) {
    if (!box) {
      continue;
    }
    if (isTextLineBox(box)) {
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
      walkPageBoxes(box.children, pageIndex, offsetDelta, visitor, depth + 1);
    }
  }
};

const forEachBoxItem = (layout, layoutIndex, visitor) => {
  if (Array.isArray(layoutIndex?.boxes) && layoutIndex.boxes.length > 0) {
    for (const item of layoutIndex.boxes) {
      visitor(item);
    }
    return;
  }

  if (!layout?.pages?.length) {
    return;
  }

  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const page = layout.pages[pageIndex];
    const boxes = Array.isArray(page?.boxes) ? page.boxes : [];
    const offsetDelta = getPageOffsetDelta(page);
    walkPageBoxes(boxes, pageIndex, offsetDelta, visitor);
  }
};

const getTableCellOwnerKeyFromLine = (line) => {
  const owner = findNearestLineOwnerWithCapability(line, "table-cell");
  return owner?.key ?? null;
};

const getTableCellOwnerKeyFromBox = (box) => {
  if (typeof box?.key !== "string" || box.key.length === 0) {
    return null;
  }
  const parts = box.key.split("/");
  return parts[parts.length - 1] || box.key;
};

const pushCellRect = (cellMap, key, left, top, right, bottom) => {
  const prev = cellMap.get(key);
  if (!prev) {
    cellMap.set(key, { left, top, right, bottom });
    return;
  }
  prev.left = Math.min(prev.left, left);
  prev.top = Math.min(prev.top, top);
  prev.right = Math.max(prev.right, right);
  prev.bottom = Math.max(prev.bottom, bottom);
};

const cellMapToRects = (cellMap) => {
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

export const getLineAtOffset = (layoutIndex, offset) => {
  return runtimeGetLineAtOffset(layoutIndex, offset);
};

const getItemBoxX = (item, line) =>
  Number.isFinite(item?.box?.x) ? Number(item.box.x) : Number.isFinite(line?.x) ? Number(line.x) : 0;

const getItemBoxY = (item, line) =>
  Number.isFinite(item?.box?.y) ? Number(item.box.y) : Number.isFinite(line?.y) ? Number(line.y) : 0;

const getItemBoxWidth = (item, line) =>
  Number.isFinite(item?.box?.width)
    ? Math.max(0, Number(item.box.width))
    : Math.max(0, Number(line?.width) || 0);

const getItemBoxHeight = (item, line, layout) =>
  Number.isFinite(item?.box?.height) && Number(item.box.height) > 0
    ? Number(item.box.height)
    : getLineHeight(line, layout);

const resolveSelectionRectForItem = ({
  item,
  layout,
  minOffset,
  maxOffset,
  scrollTop,
  viewportWidth,
}) => {
  const line = item?.line;
  if (!line) {
    return null;
  }

  const page = item.page ?? layout.pages?.[item.pageIndex] ?? null;
  const lineStart = Number.isFinite(item?.start) ? Number(item.start) : getLineStart(line, page);
  const lineEnd = Number.isFinite(item?.end) ? Number(item.end) : getLineEnd(line, page);
  const isEmptyLine = lineStart === lineEnd;
  if (isEmptyLine) {
    if (minOffset > lineStart || maxOffset <= lineEnd) {
      return null;
    }
  } else if (maxOffset <= lineStart || minOffset >= lineEnd) {
    return null;
  }

  const start = Math.max(minOffset, lineStart);
  const end = Math.min(maxOffset, lineEnd);
  const isImage = isLineVisualBlock(line);
  const xStart = isImage ? 0 : offsetToX(line, start, layout, page);
  let xEnd = isImage ? getItemBoxWidth(item, line) : offsetToX(line, end, layout, page);
  if (isEmptyLine) {
    xEnd = Math.max(xEnd, resolveEmptyLineWidth(line, layout), getItemBoxWidth(item, line));
  }

  const width = Math.max(0, xEnd - xStart);
  if (width <= 0) {
    return null;
  }

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageSpan = layout.pageHeight + layout.pageGap;
  return {
    x: pageX + getItemBoxX(item, line) + xStart,
    y: item.pageIndex * pageSpan - scrollTop + getItemBoxY(item, line),
    width,
    height: getItemBoxHeight(item, line, layout),
  };
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

  const rects = [];

  const fallbackTextLineItems = collectTextLineItemsForRange(layout, minOffset, maxOffset, {
    layoutIndex,
  });

  if (fallbackTextLineItems.length > 0) {
    const linesInRange = layoutIndex ? runtimeGetLinesInRange(layoutIndex, minOffset, maxOffset) : [];
    const textCandidateItems = mergeTextLineCandidates(linesInRange, fallbackTextLineItems);
    for (const item of textCandidateItems) {
      const rect = resolveSelectionRectForItem({
        item,
        layout,
        minOffset,
        maxOffset,
        scrollTop,
        viewportWidth,
      });
      if (rect) {
        rects.push(rect);
      }
    }
    if (rects.length > 0) {
      return rects;
    }
  }

  if (layoutIndex) {
    forEachLineItem(layout, layoutIndex, (item) => {
      const rect = resolveSelectionRectForItem({
        item,
        layout,
        minOffset,
        maxOffset,
        scrollTop,
        viewportWidth,
      });
      if (rect) {
        rects.push(rect);
      }
    });

    return rects;
  }

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);

  const pageSpan = layout.pageHeight + layout.pageGap;

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];

    const pageTop = p * pageSpan - scrollTop;

    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];

      const lineStart = getLineStart(line, page);

      const lineEnd = getLineEnd(line, page);

      const isEmptyLine = lineStart === lineEnd;
      if (isEmptyLine) {
        if (minOffset > lineStart || maxOffset <= lineEnd) {
          continue;
        }
      } else if (maxOffset <= lineStart || minOffset >= lineEnd) {
        continue;
      }

      const start = Math.max(minOffset, lineStart);

      const end = Math.min(maxOffset, lineEnd);

      const isImage = isLineVisualBlock(line);

      const xStart = isImage ? 0 : offsetToX(line, start, layout, page);
      let xEnd = isImage
        ? Math.max(xStart, line.width || 0)
        : offsetToX(line, end, layout, page);
      if (isEmptyLine) {
        xEnd = Math.max(xEnd, resolveEmptyLineWidth(line, layout));
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

const isTableCellSelection = (selection, semantics?: TableSelectionSemantics | null) => {
  const resolved = normalizeTableSelectionSemantics(semantics);
  const json = selection?.toJSON?.();
  return matchesTableSelectionNodeType(json?.type, resolved.cellSelectionJsonTypes);
};

const resolveTableCellPoint = (doc, pos, semantics?: TableSelectionSemantics | null) => {
  if (!doc || !Number.isFinite(pos)) {
    return null;
  }
  const resolved = normalizeTableSelectionSemantics(semantics);
  let $pos = null;
  try {
    $pos = doc.resolve(pos);
  } catch (_error) {
    return null;
  }
  let tableDepth = -1;
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    if (matchesTableSelectionNodeType($pos.node(depth)?.type?.name, resolved.tableNodeTypes)) {
      tableDepth = depth;
      break;
    }
  }
  if (tableDepth < 0) {
    return null;
  }
  if (
    tableDepth + 1 > $pos.depth ||
    !matchesTableSelectionNodeType($pos.node(tableDepth + 1)?.type?.name, resolved.tableRowNodeTypes)
  ) {
    return null;
  }
  if (
    tableDepth + 2 > $pos.depth ||
    !matchesTableSelectionNodeType($pos.node(tableDepth + 2)?.type?.name, resolved.tableCellNodeTypes)
  ) {
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
  semantics = null,
}) => {
  if (!layout || !selection || !doc || !isTableCellSelection(selection, semantics)) {
    return [];
  }
  const anchorPoint = resolveTableCellPoint(doc, selection.anchor, semantics);
  const headPoint = resolveTableCellPoint(doc, selection.head, semantics);
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
  const cellPaddingMap = new Map();
  forEachLineItem(layout, layoutIndex, (item) => {
    const line = item?.line;
    if (!isTableLayoutLine(line)) {
      return;
    }
    const page = layout.pages[item.pageIndex] ?? null;
    const lineStart = Number.isFinite(item?.start) ? Number(item.start) : getLineStart(line, page);
    const lineEnd = Number.isFinite(item?.end) ? Number(item.end) : getLineEnd(line, page);
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
    const ownerKey = getTableCellOwnerKeyFromLine(line);
    const key = `${item.pageIndex}:${ownerKey || `${rowIndex}:${colIndex}`}`;
    cellPaddingMap.set(key, {
      paddingX: Math.max(Number(cellPaddingMap.get(key)?.paddingX) || 0, paddingX),
      paddingY: Math.max(Number(cellPaddingMap.get(key)?.paddingY) || 0, paddingY),
    });
    pushCellRect(cellMap, key, left, top, right, bottom);
  });
  const boxCellMap = new Map();
  forEachBoxItem(layout, layoutIndex, (item) => {
    const box = item?.box;
    if (!box || !hasLayoutCapability(box, "table-cell")) {
      return;
    }
    if (item.end < offsetMin || item.start > offsetMax) {
      return;
    }
    const meta = box.meta || {};
    const rowIndex = Number.isFinite(meta?.rowIndex) ? Number(meta.rowIndex) : null;
    const colIndex = Number.isFinite(meta?.colIndex) ? Number(meta.colIndex) : null;
    if (rowIndex == null || colIndex == null) {
      return;
    }
    if (rowIndex < minRow || rowIndex > maxRow || colIndex < minCol || colIndex > maxCol) {
      return;
    }
    const rect = resolveLayoutBoxRect({
      layout,
      box,
      pageIndex: item.pageIndex,
      scrollTop,
      viewportWidth,
    });
    if (!rect) {
      return;
    }
    const ownerKey = getTableCellOwnerKeyFromBox(box);
    const key = `${item.pageIndex}:${ownerKey || `${rowIndex}:${colIndex}`}`;
    const padding = cellPaddingMap.get(key) || { paddingX: 0, paddingY: 0 };
    pushCellRect(
      boxCellMap,
      key,
      rect.x - padding.paddingX,
      rect.y - padding.paddingY,
      rect.x + rect.width + padding.paddingX + 1,
      rect.y + rect.height + padding.paddingY
    );
  });

  return boxCellMap.size > 0 ? cellMapToRects(boxCellMap) : cellMapToRects(cellMap);
};

export const tableRangeSelectionToCellRects = ({
  layout,
  fromOffset,
  toOffset,
  scrollTop,
  viewportWidth,
  layoutIndex,
  semantics: _semantics = null,
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
  const cellPaddingMap = new Map();

  forEachLineItem(layout, layoutIndex, (item) => {
    const line = item?.line;
    if (!isTableLayoutLine(line)) {
      return;
    }
    const page = layout.pages[item.pageIndex] ?? null;
    const lineStart = Number.isFinite(item?.start) ? Number(item.start) : getLineStart(line, page);
    const lineEnd = Number.isFinite(item?.end) ? Number(item.end) : getLineEnd(line, page);
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
    const ownerKey =
      getTableCellOwnerKeyFromLine(line) ??
      String(line.blockId ?? getLineBlockStart(line, page) ?? "table");
    const key = `${item.pageIndex}:${ownerKey}:${rowIndex}:${colIndex}`;
    cellPaddingMap.set(key, {
      paddingX: Math.max(Number(cellPaddingMap.get(key)?.paddingX) || 0, paddingX),
      paddingY: Math.max(Number(cellPaddingMap.get(key)?.paddingY) || 0, paddingY),
    });
    pushCellRect(cellMap, key, left, top, right, bottom);
  });
  const boxCellMap = new Map();
  forEachBoxItem(layout, layoutIndex, (item) => {
    const box = item?.box;
    if (!box || !hasLayoutCapability(box, "table-cell")) {
      return;
    }
    if (item.end < minOffset || item.start > maxOffset) {
      return;
    }
    const meta = box.meta || {};
    const rowIndex = Number.isFinite(meta?.rowIndex) ? Number(meta.rowIndex) : null;
    const colIndex = Number.isFinite(meta?.colIndex) ? Number(meta.colIndex) : null;
    if (rowIndex == null || colIndex == null) {
      return;
    }
    const rect = resolveLayoutBoxRect({
      layout,
      box,
      pageIndex: item.pageIndex,
      scrollTop,
      viewportWidth,
    });
    if (!rect) {
      return;
    }
    const ownerKey =
      getTableCellOwnerKeyFromBox(box) ??
      String(box.blockId ?? box.nodeId ?? box.type ?? "table");
    const key = `${item.pageIndex}:${ownerKey}:${rowIndex}:${colIndex}`;
    const padding = cellPaddingMap.get(key) || { paddingX: 0, paddingY: 0 };
    pushCellRect(
      boxCellMap,
      key,
      rect.x - padding.paddingX,
      rect.y - padding.paddingY,
      rect.x + rect.width + padding.paddingX + 1,
      rect.y + rect.height + padding.paddingY
    );
  });

  return boxCellMap.size > 0 ? cellMapToRects(boxCellMap) : cellMapToRects(cellMap);
};

type ActiveBlockRectOptions = {
  blockTypes?: string[];
  excludeBlockTypes?: string[];
};

const matchesResolvedBlock = ({
  line,
  page,
  targetLine,
  blockType,
  blockStart,
  blockId,
  rootIndex,
}) =>
  rootIndex != null
    ? line.rootIndex === rootIndex
    : blockId != null
      ? line.blockId === blockId
      : blockStart != null
        ? getLineBlockStart(line, page) === blockStart && line.blockType === blockType
        : line === targetLine;

const resolveOutlineMinWidth = (items: Array<{ line: any }>) =>
  items.reduce((max, item) => {
    const value = Number(item?.line?.blockAttrs?.outlineMinWidth);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

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
    ? {
        line: info.line,
        pageIndex: info.pageIndex,
        lineIndex: info.lineIndex,
        page: layout.pages[info.pageIndex] ?? null,
        start: info.start,
        end: info.end,
      }
    : layoutIndex
      ? runtimeFindLineForOffsetIndexed(layout, offset, textLength, layoutIndex)
      : findLineForOffset(layout, offset, textLength);

  if (!resolved?.line) {
    return [];
  }

  const targetLine = resolved.line;
  const blockType = targetLine.blockType;
  const blockStart = getLineBlockStart(targetLine, resolved.page ?? null);
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
  const matchedItems = [];

  if (layoutIndex) {
    forEachLineItem(layout, layoutIndex, (item) => {
      const line = item.line;
      const page = layout.pages[item.pageIndex] ?? null;

      if (
        !matchesResolvedBlock({
          line,
          page,
          targetLine,
          blockType,
          blockStart,
          blockId,
          rootIndex,
        })
      ) {
        return;
      }
      matchedItems.push({
        ...item,
        page,
      });
    });
  } else {
    for (let p = 0; p < layout.pages.length; p += 1) {
      const page = layout.pages[p];
      for (let l = 0; l < page.lines.length; l += 1) {
        const line = page.lines[l];
        if (
          !matchesResolvedBlock({
            line,
            page,
            targetLine,
            blockType,
            blockStart,
            blockId,
            rootIndex,
          })
        ) {
          continue;
        }
        matchedItems.push({
          pageIndex: p,
          lineIndex: l,
          line,
          page,
          start: getLineStart(line, page),
          end: getLineEnd(line, page),
        });
      }
    }
  }

  if (matchedItems.length === 0) {
    return [];
  }

  const minWidth = resolveOutlineMinWidth(matchedItems);
  const rangeStart = matchedItems.reduce((min, item) => Math.min(min, Number(item.start) || 0), Number.POSITIVE_INFINITY);
  const rangeEnd = matchedItems.reduce((max, item) => Math.max(max, Number(item.end) || 0), Number.NEGATIVE_INFINITY);

  if (Number.isFinite(rangeStart) && Number.isFinite(rangeEnd) && rangeEnd >= rangeStart) {
    const boxHits = collectAllLayoutBoxesForRange(layout, rangeStart, rangeEnd, {
      exact: true,
      layoutIndex,
      predicate: ({ box }) => {
        if (!box || String(box?.type || "") !== String(blockType || "")) {
          return false;
        }
        if (blockId != null && box?.blockId != null) {
          return String(box.blockId) === String(blockId);
        }
        return true;
      },
    });
    const boxRects = [];
    for (const hit of boxHits) {
      const rect = resolveLayoutBoxRect({
        layout,
        box: hit.box,
        pageIndex: hit.pageIndex,
        scrollTop,
        viewportWidth,
      });
      if (!rect) {
        continue;
      }
      const resolvedWidth = Math.max(rect.width, minWidth);
      if (resolvedWidth <= 0 || rect.height <= 0) {
        continue;
      }
      boxRects.push({
        x: rect.x,
        y: rect.y,
        width: resolvedWidth,
        height: rect.height,
      });
    }
    if (boxRects.length > 0) {
      return boxRects;
    }
  }

  const rects = [];
  for (const item of matchedItems) {
    const line = item.line;
    const visualBox = resolveLineVisualBox(line, layout);
    const width = Math.max(0, visualBox.outerWidth || 0);
    const resolvedWidth = Math.max(width, minWidth);

    if (resolvedWidth <= 0) {
      continue;
    }

    rects.push({
      x: pageX + visualBox.outerX,
      y: item.pageIndex * pageSpan - scrollTop + line.y,
      width: resolvedWidth,
      height: getLineHeight(line, layout),
    });
  }

  return rects;
}

export const findLineForOffsetIndexed = (layout, offset, textLength, layoutIndex = null) => {
  return runtimeFindLineForOffsetIndexed(layout, offset, textLength, layoutIndex);
};

export const offsetAtXIndexed = (layout, line, x, page = null) => {
  if (!page) {
    return offsetAtX(layout.font, line, x);
  }
  const adjustedLine = {
    ...line,
    start: getLineStart(line, page),
    end: getLineEnd(line, page),
    blockStart: getLineBlockStart(line, page),
    __offsetDelta: getRunOffsetDelta(line, page),
  };
  return offsetAtX(layout.font, adjustedLine, x);
};
