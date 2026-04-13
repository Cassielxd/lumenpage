import { breakLines } from "../lineBreaker.js";
import { docToRuns, textblockToRuns } from "../textRuns.js";
import { resolveContainerLayoutContext } from "../containerLayout.js";
import { isLeafLayoutNode } from "../layoutRole.js";
import { ensureBlockFragmentOwner, shiftFragmentOwners } from "./fragmentOwners.js";

const normalizeTableCellBackground = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", text) ? text : null;
  }
  if (typeof document === "undefined") {
    return text;
  }
  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = text;
  const normalized = String(probe.style.color || "").trim();
  return normalized || null;
};

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const measureLinesHeight = (lines, fallbackLineHeight) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  let usedRelativeY = false;
  let maxBottom = 0;
  let cursor = 0;
  for (const line of lines) {
    const lineHeight = Number.isFinite(line?.lineHeight)
      ? line.lineHeight
      : Math.max(1, Number(fallbackLineHeight) || 1);
    if (Number.isFinite(line?.relativeY)) {
      usedRelativeY = true;
      maxBottom = Math.max(maxBottom, line.relativeY + lineHeight);
      continue;
    }
    cursor += lineHeight;
  }
  return usedRelativeY ? maxBottom : cursor;
};

const getTableShape = (node) => {
  const rows = node.childCount;
  let cols = 0;

  node.forEach((row) => {
    let logicalCols = 0;
    row.forEach((cell) => {
      const span = Number.isFinite(cell?.attrs?.colspan) ? cell.attrs.colspan : 1;
      logicalCols += Math.max(1, span);
    });
    cols = Math.max(cols, logicalCols);
  });

  return {
    rows: Math.max(1, rows),
    cols: Math.max(1, cols),
  };
};

const getNodeFragmentKey = (node, fallbackPrefix: string) => {
  if (node?.attrs?.id) {
    return `${fallbackPrefix}:${node.attrs.id}`;
  }
  if (typeof node?.hashCode === "function") {
    const hash = node.hashCode();
    if (hash != null) {
      return `${fallbackPrefix}:${String(hash)}`;
    }
  }
  return `${fallbackPrefix}:${node?.type?.name || "table"}`;
};

const createFragmentContinuationAttrs = (continuation) => ({
  fragmentIdentity: continuation.fragmentIdentity,
  fragmentContinuationToken: continuation.continuationToken,
  fragmentCarryState: continuation.carryState,
});

const createTableContinuation = ({
  tableKey,
  rows,
  cols,
  firstRowIndex,
  lastRowIndex,
  rowSplit,
  continuedFromPrev,
  continuesAfter,
  rowOffsetY = 0,
}) => {
  const fragmentIdentity = `table:${tableKey}`;
  return {
    fromPrev: continuedFromPrev === true,
    hasNext: continuesAfter === true,
    rowSplit: rowSplit === true,
    fragmentIdentity,
    continuationToken: `${fragmentIdentity}:continuation`,
    carryState: {
      kind: "table",
      tableKey,
      rows,
      cols,
      firstRowIndex,
      lastRowIndex,
      rowOffsetY: Math.max(0, Number(rowOffsetY) || 0),
      rowSplit: rowSplit === true,
      continuedFromPrev: continuedFromPrev === true,
      continuesAfter: continuesAfter === true,
    },
  };
};

const getTableSliceMeta = (line) => line?.tableOwnerMeta || line?.tableMeta || null;

const sumHeights = (rows, count?: number) => {
  const values = Array.isArray(rows) ? rows : [];
  const limit = Math.min(count ?? values.length, values.length);
  let total = 0;
  for (let i = 0; i < limit; i += 1) {
    total += Number(values[i]) || 0;
  }
  return total;
};

const measureFragmentLength = (lines, fallbackLength = 0) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return Number.isFinite(fallbackLength) ? Math.max(0, Number(fallbackLength)) : 0;
  }
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    if (Number.isFinite(line?.start)) {
      minStart = Math.min(minStart, Number(line.start));
    }
    if (Number.isFinite(line?.end)) {
      maxEnd = Math.max(maxEnd, Number(line.end));
    }
  }
  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    return Number.isFinite(fallbackLength) ? Math.max(0, Number(fallbackLength)) : 0;
  }
  return Math.max(0, maxEnd - minStart);
};

const buildTableSplitResult = ({
  visibleLines,
  visibleLength,
  visibleHeight,
  visibleContinuation,
  overflowLines,
  overflowLength,
  overflowHeight,
  overflowContinuation,
}) => {
  const normalizedVisibleLength = measureFragmentLength(visibleLines, visibleLength);
  const fragments = [
    {
      kind: "visible",
      lines: Array.isArray(visibleLines) ? visibleLines : [],
      length: normalizedVisibleLength,
      height: Number.isFinite(visibleHeight) ? Math.max(0, Number(visibleHeight)) : 0,
      continuation: visibleContinuation || null,
    },
  ];

  const result: any = {
    lines: Array.isArray(visibleLines) ? visibleLines : [],
    length: normalizedVisibleLength,
    height: Number.isFinite(visibleHeight) ? Math.max(0, Number(visibleHeight)) : 0,
    continuation: visibleContinuation || null,
    fragments,
  };

  if (Array.isArray(overflowLines) && overflowLines.length > 0) {
    const normalizedOverflowLength = measureFragmentLength(overflowLines, overflowLength);
    const overflow = {
      lines: overflowLines,
      length: normalizedOverflowLength,
      height: Number.isFinite(overflowHeight) ? Math.max(0, Number(overflowHeight)) : 0,
      continuation: overflowContinuation || null,
    };
    result.overflow = overflow;
    fragments.push({
      kind: "overflow",
      ...overflow,
    });
  }

  return result;
};

const resolveTableKey = (lines, blockAttrs) => {
  const firstLine = Array.isArray(lines) && lines.length > 0 ? lines[0] : null;
  const candidates = [
    blockAttrs?.tableKey,
    getTableSliceMeta(firstLine)?.tableKey,
    blockAttrs?.fragmentIdentity,
    getTableSliceMeta(firstLine)?.fragmentIdentity,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.length === 0) {
      continue;
    }
    if (candidate.startsWith("table:")) {
      return candidate.slice("table:".length);
    }
    return candidate;
  }

  const blockId = blockAttrs?.blockId ?? firstLine?.blockId ?? null;
  if (blockId != null && blockId !== "") {
    return String(blockId);
  }

  const blockStart = Number.isFinite(firstLine?.blockStart) ? Number(firstLine.blockStart) : null;
  if (blockStart != null) {
    return `start:${blockStart}`;
  }

  return "table";
};

const createTableRootOwner = ({ node, tableKey, settings, tableWidth, colWidth, padding, paddingY }) => ({
  key: tableKey,
  type: "table",
  role: "table",
  nodeId: node?.attrs?.id ?? null,
  x: settings.margin.left,
  y: 0,
  width: tableWidth,
  fixedBounds: false,
  meta: {
    tableWidth,
    colWidth,
    padding,
    paddingY,
    layoutCapabilities: {
      "table-root": true,
      "table-structure": true,
    },
  },
});

const createTableRowOwner = ({ tableKey, rowIndex, rowTop, rowHeight, settings, tableWidth }) => ({
  key: `${tableKey}:row:${rowIndex}`,
  type: "tableRow",
  role: "table-row",
  nodeId: null,
  blockId: null,
  x: settings.margin.left,
  y: rowTop,
  width: tableWidth,
  height: rowHeight,
  fixedBounds: true,
  meta: {
    rowIndex,
    absoluteRowIndex: rowIndex,
    sliceRowIndex: rowIndex,
    rowHeight,
    tableWidth,
    layoutCapabilities: {
      "table-row": true,
      "table-structure": true,
    },
  },
});
const createTableCellOwner = ({ tableKey, cell, settings, colWidth, padding }) => ({
  key: `${tableKey}:cell:${cell.rowIndex}:${cell.colStart ?? cell.colIndex}:${cell.startOffset}`,
  type: cell.header ? "tableHeader" : "tableCell",
  role: "table-cell",
  x: settings.margin.left + (cell.colStart ?? cell.colIndex) * colWidth + padding,
  width: Math.max(0, colWidth * (cell.colspan ?? 1) - padding * 2),
  fixedBounds: false,
  meta: {
    rowIndex: cell.rowIndex,
    colIndex: cell.colStart ?? cell.colIndex,
    colspan: cell.colspan ?? 1,
    rowspan: cell.rowspan ?? 1,
    header: cell.header === true,
    background: normalizeTableCellBackground(cell.background),
    layoutCapabilities: {
      "content-container": true,
      "table-cell": true,
      "table-structure": true,
    },
  },
});

const offsetLine = (line, delta) => {
  if (typeof line.start === "number") {
    line.start += delta;
  }
  if (typeof line.end === "number") {
    line.end += delta;
  }
  if (Number.isFinite(line?.blockStart)) {
    line.blockStart += delta;
  }
  if (line.runs) {
    for (const run of line.runs) {
      if (typeof run.start === "number") {
        run.start += delta;
      }
      if (typeof run.end === "number") {
        run.end += delta;
      }
    }
  }
  return line;
};

const resolveSettingsWithIndent = (settings, indent) => {
  if (!indent) {
    return settings;
  }
  return {
    ...settings,
    margin: {
      ...settings.margin,
      left: settings.margin.left + indent,
    },
  };
};

const computeLineX = (line, settings) => {
  const { pageWidth, margin } = settings;
  const maxWidth = pageWidth - margin.left - margin.right;
  const align = line.blockAttrs?.align || "left";
  const indent = line.blockAttrs?.indent || 0;
  let x = margin.left;

  if (align === "center") {
    x += Math.max(0, (maxWidth - line.width) / 2);
  } else if (align === "right") {
    x += Math.max(0, maxWidth - line.width);
  }

  if (indent && line.blockStart === line.start) {
    x += indent;
  }

  return x;
};

const applyContainerStack = (line, containerStack) => {
  if (containerStack && containerStack.length) {
    line.containers = containerStack;
  }
  return line;
};

const layoutLeafInCell = ({
  node,
  settings,
  registry,
  context,
  blockStartOffset,
  baseY,
  cellBaseX,
}) => {
  const renderer = registry?.get(node.type.name);
  const blockSettings = resolveSettingsWithIndent(settings, context.indent);
  const blockId = node.attrs?.id ?? null;
  let blockAttrs = node.attrs || null;
  let blockLineHeight = null;
  let result = null;

  if (renderer?.layoutBlock) {
    result = renderer.layoutBlock({
      node,
      availableHeight: Number.POSITIVE_INFINITY,
      measureTextWidth: blockSettings.measureTextWidth,
      settings: blockSettings,
      registry,
      indent: context.indent,
      containerStack: context.containerStack,
    });
  } else {
    const runsResult = renderer?.toRuns
      ? renderer.toRuns(node, blockSettings, registry)
      : node.isTextblock
        ? textblockToRuns(node, blockSettings, node.type.name, blockId, node.attrs, 0, registry)
        : docToRuns(node, blockSettings, registry);

    const { runs, length } = runsResult;
    if (runsResult?.blockAttrs) {
      blockAttrs = runsResult.blockAttrs;
    }
    if (runsResult?.blockAttrs?.lineHeight) {
      blockLineHeight = runsResult.blockAttrs.lineHeight;
    }

    const lines = breakLines(
      runs,
      blockSettings.pageWidth - blockSettings.margin.left - blockSettings.margin.right,
      blockSettings.font,
      length,
      blockSettings.wrapTolerance || 0,
      blockSettings.minLineWidth || 0,
      blockSettings.measureTextWidth,
      blockSettings.segmentText
    );
    result = {
      lines,
      length,
      height: measureLinesHeight(lines, blockLineHeight || settings.lineHeight),
    };
  }

  const lines = result?.lines?.length
    ? result.lines
    : [{ text: "", start: 0, end: 0, width: 0, runs: [] }];
  const length = result?.length ?? 0;
  const lineHeightValue = Number.isFinite(blockAttrs?.lineHeight)
    ? blockAttrs.lineHeight
    : settings.lineHeight;

  let height = Number.isFinite(result?.height) ? result.height : lines.length * lineHeightValue;
  if (!Number.isFinite(height) || height <= 0) {
    height = measureLinesHeight(lines, lineHeightValue);
  }

  const adjustedLines = lines.map((line, lineIndex) => {
    const lineCopy = {
      ...line,
      runs: line.runs ? line.runs.map((run) => ({ ...run })) : line.runs,
    };
    lineCopy.blockType = lineCopy.blockType || node.type.name;
    lineCopy.blockId = lineCopy.blockId ?? blockId;
    lineCopy.blockAttrs = lineCopy.blockAttrs || blockAttrs;
    if (lineCopy.blockStart == null) {
      lineCopy.blockStart = blockStartOffset;
    }
    offsetLine(lineCopy, blockStartOffset);
    const localRelY =
      typeof lineCopy.relativeY === "number" ? lineCopy.relativeY : lineIndex * lineHeightValue;
    lineCopy.relativeY = baseY + localRelY;
    lineCopy.lineHeight = lineCopy.lineHeight ?? lineHeightValue;
    if (typeof lineCopy.x !== "number") {
      lineCopy.x = computeLineX(lineCopy, blockSettings);
    }
    if (lineCopy.tableOwnerMeta && Number.isFinite(cellBaseX)) {
      lineCopy.tableOwnerMeta = {
        ...lineCopy.tableOwnerMeta,
        tableXOffset: (lineCopy.tableOwnerMeta.tableXOffset ?? 0) + cellBaseX,
      };
    }
    if (lineCopy.tableMeta && Number.isFinite(cellBaseX)) {
      lineCopy.tableMeta = {
        ...lineCopy.tableMeta,
        tableXOffset: (lineCopy.tableMeta.tableXOffset ?? 0) + cellBaseX,
      };
    }
    if (Number.isFinite(lineCopy?.blockAttrs?.codeBlockOuterX) && Number.isFinite(cellBaseX)) {
      lineCopy.blockAttrs = {
        ...(lineCopy.blockAttrs || {}),
        codeBlockOuterX: Number(lineCopy.blockAttrs.codeBlockOuterX) + cellBaseX,
      };
    }
    applyContainerStack(lineCopy, context.containerStack);
    lineCopy.fragmentOwners = ensureBlockFragmentOwner({
      line: lineCopy,
      node,
      blockId,
      blockStart: blockStartOffset,
      blockAttrs: lineCopy.blockAttrs,
    });
    if (Array.isArray(lineCopy.fragmentOwners) && lineCopy.fragmentOwners.length > 0) {
      lineCopy.fragmentOwners = shiftFragmentOwners(lineCopy.fragmentOwners, 0, baseY);
    }
    return lineCopy;
  });

  if (!Number.isFinite(height) || height <= 0) {
    const maxY = adjustedLines.reduce((max, line) => {
      const relY = typeof line.relativeY === "number" ? line.relativeY - baseY : 0;
      const lh = Number.isFinite(line.lineHeight) ? line.lineHeight : lineHeightValue;
      return Math.max(max, relY + lh);
    }, 0);
    height = maxY;
  }

  return { lines: adjustedLines, length, height };
};

const layoutNodeInCell = ({
  node,
  settings,
  registry,
  context,
  startOffset,
  baseY,
  blockSpacing,
  cellBaseX,
}) => {
  const renderer = registry?.get(node.type.name);
  const isLeaf = isLeafLayoutNode(renderer, node);

  if (isLeaf) {
    return layoutLeafInCell({
      node,
      settings,
      registry,
      context,
      blockStartOffset: startOffset,
      baseY,
      cellBaseX,
    });
  }
  const { nextContext } = resolveContainerLayoutContext({
    renderer,
    node,
    settings,
    registry,
    context,
    baseX: cellBaseX,
  });

  let offset = startOffset;
  let y = baseY;
  let height = 0;
  const lines = [];

  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    const childResult = layoutNodeInCell({
      node: child,
      settings,
      registry,
      context: nextContext,
      startOffset: offset,
      baseY: y,
      blockSpacing,
      cellBaseX,
    });
    lines.push(...childResult.lines);
    offset += childResult.length;
    y += childResult.height;
    height += childResult.height;
    if (i < node.childCount - 1) {
      offset += 1;
      if (blockSpacing > 0) {
        y += blockSpacing;
        height += blockSpacing;
      }
    }
  }

  return { lines, length: offset - startOffset, height };
};

const layoutCell = (cell, settings, registry, maxWidth, cellBaseX) => {
  if (!cell) {
    return { lines: [{ text: "", start: 0, end: 0, width: 0, runs: [] }], length: 0, height: 0 };
  }

  const cellSettings = {
    ...settings,
    pageWidth: maxWidth,
    margin: { ...settings.margin, left: 0, right: 0, top: 0, bottom: 0 },
  };
  const blockSpacing = Number.isFinite(settings.blockSpacing) ? settings.blockSpacing : 0;

  return layoutNodeInCell({
    node: cell,
    settings: cellSettings,
    registry,
    context: { indent: 0, containerStack: [] },
    startOffset: 0,
    baseY: 0,
    blockSpacing,
    cellBaseX,
  });
};

const drawTableChrome = ({ ctx, tableX, tableY, tableMeta }) => {
  if (!tableMeta || !Number.isFinite(tableMeta?.tableWidth) || !Number.isFinite(tableMeta?.tableHeight)) {
    return;
  }

  const {
    rows,
    cols,
    rowHeights,
    tableWidth,
    colWidth,
    tableHeight,
    continuedFromPrev,
    continuesAfter,
    rowSplit,
    sliceBreak,
    cells,
  } = tableMeta;

  const suppressTop = !!rowSplit && !!continuedFromPrev;
  const suppressBottom = !!rowSplit && !!continuesAfter;
  const forceTop = !rowSplit && !!sliceBreak && !!continuedFromPrev;
  const forceBottom = !rowSplit && !!sliceBreak && !!continuesAfter;
  const showTop = !suppressTop && (!continuedFromPrev || forceTop);
  const showBottom = !suppressBottom && (!continuesAfter || forceBottom);

  ctx.save();
  if (Array.isArray(cells) && cells.length > 0) {
    for (const cell of cells) {
      const explicitBackground = normalizeTableCellBackground(cell?.background);
      const fillColor = explicitBackground || (cell?.header === true ? "#f3f4f6" : null);
      if (!fillColor) {
        continue;
      }
      const x = tableX + (Number.isFinite(cell.x) ? Number(cell.x) : 0);
      const y = tableY + (Number.isFinite(cell.y) ? Number(cell.y) : 0);
      const width = Number.isFinite(cell.width) ? Number(cell.width) : 0;
      const height = Number.isFinite(cell.height) ? Number(cell.height) : 0;
      if (width > 0 && height > 0) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, width, height);
      }
    }
  }
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 1;

  if (Array.isArray(cells) && cells.length > 0) {
    const hSegments = new Map();
    const vSegments = new Map();
    const toKey = (value) => Number(value).toFixed(3);
    const addH = (y, x1, x2) => {
      const start = Math.min(x1, x2);
      const end = Math.max(x1, x2);
      const key = `${toKey(y)}:${toKey(start)}:${toKey(end)}`;
      if (!hSegments.has(key)) {
        hSegments.set(key, { y, x1: start, x2: end });
      }
    };
    const addV = (x, y1, y2) => {
      const start = Math.min(y1, y2);
      const end = Math.max(y1, y2);
      const key = `${toKey(x)}:${toKey(start)}:${toKey(end)}`;
      if (!vSegments.has(key)) {
        vSegments.set(key, { x, y1: start, y2: end });
      }
    };

    for (const cell of cells) {
      const x1 = tableX + (Number.isFinite(cell.x) ? Number(cell.x) : 0);
      const y1 = tableY + (Number.isFinite(cell.y) ? Number(cell.y) : 0);
      const x2 = x1 + (Number.isFinite(cell.width) ? Number(cell.width) : 0);
      const y2 = y1 + (Number.isFinite(cell.height) ? Number(cell.height) : 0);
      addH(y1, x1, x2);
      addH(y2, x1, x2);
      addV(x1, y1, y2);
      addV(x2, y1, y2);
    }

    const topY = tableY;
    const bottomY = tableY + tableHeight;
    const epsilon = 0.5;
    ctx.beginPath();
    for (const segment of hSegments.values()) {
      const isTopEdge = Math.abs(segment.y - topY) <= epsilon;
      const isBottomEdge = Math.abs(segment.y - bottomY) <= epsilon;
      if (isTopEdge && !showTop) {
        continue;
      }
      if (isBottomEdge && !showBottom) {
        continue;
      }
      ctx.moveTo(segment.x1, segment.y);
      ctx.lineTo(segment.x2, segment.y);
    }
    for (const segment of vSegments.values()) {
      ctx.moveTo(segment.x, segment.y1);
      ctx.lineTo(segment.x, segment.y2);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(tableX, tableY);
  ctx.lineTo(tableX, tableY + tableHeight);
  ctx.moveTo(tableX + tableWidth, tableY);
  ctx.lineTo(tableX + tableWidth, tableY + tableHeight);
  if (showTop) {
    ctx.moveTo(tableX, tableY);
    ctx.lineTo(tableX + tableWidth, tableY);
  }
  if (showBottom) {
    ctx.moveTo(tableX, tableY + tableHeight);
    ctx.lineTo(tableX + tableWidth, tableY + tableHeight);
  }
  ctx.stroke();

  let rowY = tableY;
  for (let r = 0; r < Number(rows) - 1; r += 1) {
    rowY += Number(rowHeights?.[r]) || 0;
    ctx.beginPath();
    ctx.moveTo(tableX, rowY);
    ctx.lineTo(tableX + tableWidth, rowY);
    ctx.stroke();
  }

  for (let c = 1; c < Number(cols); c += 1) {
    const x = tableX + c * Number(colWidth);
    ctx.beginPath();
    ctx.moveTo(x, tableY);
    ctx.lineTo(x, tableY + tableHeight);
    ctx.stroke();
  }

  ctx.restore();
};

const measureTableSliceRange = (lines, baseStartPos, fallbackStartPos, fallbackEndPos) => {
  const sourceLines = Array.isArray(lines) ? lines : [];
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const line of sourceLines) {
    if (Number.isFinite(line?.start)) {
      minStart = Math.min(minStart, Number(line.start));
    }
    if (Number.isFinite(line?.end)) {
      maxEnd = Math.max(maxEnd, Number(line.end));
    }
  }
  const resolvedStart = Number.isFinite(minStart)
    ? Number(baseStartPos || 0) + minStart
    : Number.isFinite(fallbackStartPos)
      ? Number(fallbackStartPos)
      : Number(baseStartPos || 0);
  const resolvedEnd = Number.isFinite(maxEnd)
    ? Number(baseStartPos || 0) + maxEnd
    : Number.isFinite(fallbackEndPos)
      ? Number(fallbackEndPos)
      : resolvedStart;
  return {
    startPos: resolvedStart,
    endPos: Math.max(resolvedStart, resolvedEnd),
  };
};

const createTableSliceSnapshot = ({ measured, snapshot, fallbackStartPos, fallbackEndPos }) => {
  const lines = Array.isArray(snapshot?.lines) ? snapshot.lines : [];
  const baseStartPos = Number(measured?.startPos || 0);
  const range = measureTableSliceRange(lines, baseStartPos, fallbackStartPos, fallbackEndPos);
  return {
    lines,
    length: Math.max(0, Number(snapshot?.length || 0)),
    height: Number.isFinite(snapshot?.height) ? Number(snapshot.height) : 0,
    blockAttrs: snapshot?.blockAttrs || null,
    continuation: snapshot?.continuation || null,
    startPos: range.startPos,
    endPos: range.endPos,
  };
};

const buildMeasuredTableModelFromLayout = ({ node, layoutResult, startPos = 0 }) => {
  if (!layoutResult || typeof layoutResult !== "object") {
    return null;
  }

  const lines = Array.isArray(layoutResult.lines) ? layoutResult.lines : [];
  const blockAttrs = layoutResult.blockAttrs || {};
  const tableMeta =
    lines.find((line) => line?.tableOwnerMeta)?.tableOwnerMeta ||
    lines.find((line) => line?.tableMeta)?.tableMeta ||
    null;
  const rootNodeId = node?.attrs?.id ?? null;
  const rootBlockId = rootNodeId;
  const length = Math.max(0, Number(layoutResult.length || 0));
  const tableWidth = Number.isFinite(blockAttrs?.tableWidth)
    ? Number(blockAttrs.tableWidth)
    : Number.isFinite(tableMeta?.tableWidth)
      ? Number(tableMeta.tableWidth)
      : 0;
  const tableHeight = Number.isFinite(layoutResult.height)
    ? Number(layoutResult.height)
    : Number.isFinite(tableMeta?.tableHeight)
      ? Number(tableMeta.tableHeight)
      : 0;

  const rowEntries = new Map();
  const cellEntries = new Map();

  const getOrCreateRowEntry = (owner, fallbackRowIndex) => {
    const ownerMeta = owner?.meta || {};
    const absoluteRowIndex = Number.isFinite(ownerMeta?.absoluteRowIndex)
      ? Number(ownerMeta.absoluteRowIndex)
      : Number.isFinite(ownerMeta?.rowIndex)
        ? Number(ownerMeta.rowIndex)
        : Number(fallbackRowIndex || 0);
    const key = String(owner?.key || `table-row:${absoluteRowIndex}`);
    let entry = rowEntries.get(key);
    if (!entry) {
      entry = {
        key,
        absoluteRowIndex,
        owner,
        startPos: Number.POSITIVE_INFINITY,
        endPos: Number.NEGATIVE_INFINITY,
        cells: [],
      };
      rowEntries.set(key, entry);
    }
    return entry;
  };

  const getOrCreateCellEntry = (owner, rowEntry, fallbackRowIndex, fallbackColIndex) => {
    const ownerMeta = owner?.meta || {};
    const rowIndex = Number.isFinite(ownerMeta?.rowIndex)
      ? Number(ownerMeta.rowIndex)
      : Number(fallbackRowIndex || 0);
    const colIndex = Number.isFinite(ownerMeta?.colIndex)
      ? Number(ownerMeta.colIndex)
      : Number(fallbackColIndex || 0);
    const key = String(owner?.key || `table-cell:${rowIndex}:${colIndex}`);
    let entry = cellEntries.get(key);
    if (!entry) {
      entry = {
        key,
        rowIndex,
        colIndex,
        owner,
        startPos: Number.POSITIVE_INFINITY,
        endPos: Number.NEGATIVE_INFINITY,
      };
      cellEntries.set(key, entry);
      rowEntry.cells.push(entry);
    }
    return entry;
  };

  for (const line of lines) {
    const lineStart = Number.isFinite(line?.start) ? Number(line.start) : 0;
    const lineEnd = Number.isFinite(line?.end) ? Number(line.end) : lineStart;
    const absoluteStart = startPos + lineStart;
    const absoluteEnd = startPos + lineEnd;
    const fragmentOwners = Array.isArray(line?.fragmentOwners) ? line.fragmentOwners : [];

    let rowEntry = null;
    let fallbackRowIndex = Number.isFinite(line?.blockAttrs?.rowIndex)
      ? Number(line.blockAttrs.rowIndex)
      : 0;
    let fallbackColIndex = Number.isFinite(line?.blockAttrs?.colIndex)
      ? Number(line.blockAttrs.colIndex)
      : 0;

    for (const owner of fragmentOwners) {
      if (!owner || typeof owner !== "object") {
        continue;
      }
      if (owner.role === "table-row") {
        rowEntry = getOrCreateRowEntry(owner, fallbackRowIndex);
        fallbackRowIndex = rowEntry.absoluteRowIndex;
        rowEntry.startPos = Math.min(rowEntry.startPos, absoluteStart);
        rowEntry.endPos = Math.max(rowEntry.endPos, absoluteEnd);
      }
    }

    if (!rowEntry) {
      rowEntry = getOrCreateRowEntry(null, fallbackRowIndex);
      rowEntry.startPos = Math.min(rowEntry.startPos, absoluteStart);
      rowEntry.endPos = Math.max(rowEntry.endPos, absoluteEnd);
    }

    for (const owner of fragmentOwners) {
      if (!owner || typeof owner !== "object") {
        continue;
      }
      if (owner.role === "table-cell") {
        const cellEntry = getOrCreateCellEntry(owner, rowEntry, fallbackRowIndex, fallbackColIndex);
        fallbackColIndex = cellEntry.colIndex;
        cellEntry.startPos = Math.min(cellEntry.startPos, absoluteStart);
        cellEntry.endPos = Math.max(cellEntry.endPos, absoluteEnd);
      }
    }
  }

  const rows = Array.from(rowEntries.values())
    .sort((left, right) => left.absoluteRowIndex - right.absoluteRowIndex)
    .map((rowEntry) => {
      const rowOwner = rowEntry.owner;
      const rowChildren = rowEntry.cells
        .sort((left, right) => left.colIndex - right.colIndex)
        .map((cellEntry) => {
          const cellOwner = cellEntry.owner;
          const cellMeta = cellOwner?.meta && typeof cellOwner.meta === "object" ? cellOwner.meta : {};
          return {
            kind: "table-cell",
            nodeId: null,
            blockId: rootBlockId,
            startPos: Number.isFinite(cellEntry.startPos) ? cellEntry.startPos : startPos,
            endPos: Number.isFinite(cellEntry.endPos) ? cellEntry.endPos : startPos,
            width: Number.isFinite(cellOwner?.width) ? Number(cellOwner.width) : 0,
            height: Number.isFinite(cellOwner?.height) ? Number(cellOwner.height) : null,
            children: [],
            meta: {
              key: cellEntry.key,
              rowIndex: cellEntry.rowIndex,
              colIndex: cellEntry.colIndex,
              x: Number.isFinite(cellOwner?.x) ? Number(cellOwner.x) : null,
              y: Number.isFinite(cellOwner?.y) ? Number(cellOwner.y) : null,
              colspan: Number.isFinite(cellMeta?.colspan) ? Number(cellMeta.colspan) : 1,
              rowspan: Number.isFinite(cellMeta?.rowspan) ? Number(cellMeta.rowspan) : 1,
              header: cellMeta?.header === true,
              background: cellMeta?.background ?? null,
            },
          };
        });

      const rowMeta = rowOwner?.meta && typeof rowOwner.meta === "object" ? rowOwner.meta : {};
      return {
        kind: "table-row",
        nodeId: null,
        blockId: rootBlockId,
        startPos: Number.isFinite(rowEntry.startPos) ? rowEntry.startPos : startPos,
        endPos: Number.isFinite(rowEntry.endPos) ? rowEntry.endPos : startPos,
        width: Number.isFinite(rowOwner?.width) ? Number(rowOwner.width) : tableWidth,
        height: Number.isFinite(rowOwner?.height) ? Number(rowOwner.height) : null,
        children: rowChildren,
        meta: {
          key: rowEntry.key,
          rowIndex: rowEntry.absoluteRowIndex,
          sliceRowIndex: Number.isFinite(rowMeta?.sliceRowIndex)
            ? Number(rowMeta.sliceRowIndex)
            : rowEntry.absoluteRowIndex,
          x: Number.isFinite(rowOwner?.x) ? Number(rowOwner.x) : null,
          y: Number.isFinite(rowOwner?.y) ? Number(rowOwner.y) : null,
          rowHeight: Number.isFinite(rowMeta?.rowHeight) ? Number(rowMeta.rowHeight) : null,
        },
      };
    });

  return {
    kind: "table",
    nodeId: rootNodeId,
    blockId: rootBlockId,
    startPos,
    endPos: startPos + length,
    width: tableWidth,
    height: tableHeight,
    children: rows,
    meta: {
      rows: Number.isFinite(blockAttrs?.rows) ? Number(blockAttrs.rows) : rows.length,
      cols: Number.isFinite(blockAttrs?.cols) ? Number(blockAttrs.cols) : 0,
      rowHeights: Array.isArray(blockAttrs?.rowHeights) ? [...blockAttrs.rowHeights] : [],
      colWidth: Number.isFinite(blockAttrs?.colWidth) ? Number(blockAttrs.colWidth) : null,
      tableWidth,
      padding: Number.isFinite(blockAttrs?.padding) ? Number(blockAttrs.padding) : null,
      paddingY: Number.isFinite(blockAttrs?.paddingY) ? Number(blockAttrs.paddingY) : null,
      tableKey: blockAttrs?.tableKey ?? tableMeta?.tableKey ?? null,
      source: "legacy-layout-adapter",
      layoutSnapshot: {
        lines,
        length,
        height: tableHeight,
        blockAttrs,
        continuation: layoutResult?.continuation || null,
      },
    },
  };
};
export const splitTableBlock = ({
  lines,
  length,
  availableHeight,
  blockAttrs,
  settings,
  sliceRowIndex = undefined,
  sliceRowOffsetY = 0,
  inheritedSliceFromPrev = undefined,
  inheritedRowSplit = undefined,
}) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }

  const firstLine = lines[0];
  const firstAttrs = firstLine?.blockAttrs || {};
  const firstMeta = getTableSliceMeta(firstLine) || {};
  const continuationCarryStateCandidates = [
    blockAttrs?.fragmentCarryState,
    firstAttrs?.fragmentCarryState,
    firstMeta?.fragmentCarryState,
    blockAttrs?.carryState,
    firstAttrs?.carryState,
    firstMeta?.carryState,
  ].filter((value) => value && typeof value === "object");
  const continuationCarryState =
    continuationCarryStateCandidates.find((value: any) => value?.kind === "table") || null;
  let fullRowHeights = Array.isArray(blockAttrs?.rowHeights) ? blockAttrs.rowHeights : [];
  if (fullRowHeights.length === 0 && Array.isArray(firstAttrs.rowHeights)) {
    fullRowHeights = firstAttrs.rowHeights;
  }
  if (fullRowHeights.length === 0) {
    const fallbackLine = lines.find((line) => Array.isArray(line?.blockAttrs?.rowHeights));
    if (fallbackLine?.blockAttrs?.rowHeights) {
      fullRowHeights = fallbackLine.blockAttrs.rowHeights;
    }
  }
  if (fullRowHeights.length === 0 && Array.isArray(firstMeta?.rowHeights)) {
    fullRowHeights = firstMeta.rowHeights;
  }
  if (fullRowHeights.length === 0) {
    return null;
  }

  const rows = Number.isFinite(continuationCarryState?.rows)
    ? Math.max(fullRowHeights.length, Number(continuationCarryState.rows))
    : fullRowHeights.length;
  const cols =
    Number.isFinite(blockAttrs?.cols)
      ? Number(blockAttrs.cols)
      : Number.isFinite(firstAttrs?.cols)
        ? Number(firstAttrs.cols)
        : Number(firstMeta?.cols) || 0;
  const colWidth =
    Number.isFinite(blockAttrs?.colWidth)
      ? Number(blockAttrs.colWidth)
      : Number.isFinite(firstAttrs?.colWidth)
        ? Number(firstAttrs.colWidth)
        : Number(firstMeta?.colWidth) || 0;
  const tableWidth =
    Number.isFinite(blockAttrs?.tableWidth)
      ? Number(blockAttrs.tableWidth)
      : Number.isFinite(firstAttrs?.tableWidth)
        ? Number(firstAttrs.tableWidth)
        : Number(firstMeta?.tableWidth) || 0;
  const padding =
    Number.isFinite(blockAttrs?.padding)
      ? Number(blockAttrs.padding)
      : Number.isFinite(firstAttrs?.padding)
        ? Number(firstAttrs.padding)
        : Number(firstMeta?.padding) || 0;
  const paddingY =
    Number.isFinite(blockAttrs?.paddingY)
      ? Number(blockAttrs.paddingY)
      : Number.isFinite(firstAttrs?.paddingY)
        ? Number(firstAttrs.paddingY)
        : Number(firstMeta?.paddingY) || 0;
  const tableXOffset = Number.isFinite(firstMeta?.tableXOffset) ? Number(firstMeta.tableXOffset) : 0;
  const tableKey = resolveTableKey(lines, blockAttrs);

  const inferredRowOffset = lines.reduce((minRow, line) => {
    const rowIndex =
      Number.isFinite(line?.blockAttrs?.rowIndex)
        ? Number(line.blockAttrs.rowIndex)
        : Number.isFinite(getTableSliceMeta(line)?.rowIndex)
          ? Number(getTableSliceMeta(line).rowIndex)
          : Number.POSITIVE_INFINITY;
    return Math.min(minRow, rowIndex);
  }, Number.POSITIVE_INFINITY);
  const resolvedRowOffset = Number.isFinite(sliceRowIndex)
    ? Math.max(0, Number(sliceRowIndex))
    : Number.isFinite(inferredRowOffset)
      ? Number(inferredRowOffset)
      : 0;
  const rowHeightsBaseIndex =
    Number.isFinite(continuationCarryState?.firstRowIndex) &&
    Number(continuationCarryState.firstRowIndex) >= 0 &&
    rows > fullRowHeights.length
      ? Number(continuationCarryState.firstRowIndex)
      : 0;
  const resolvedRowOffsetInSlice = Math.max(0, resolvedRowOffset - rowHeightsBaseIndex);
  const resolvedRowOffsetY = Math.max(0, Number(sliceRowOffsetY) || 0);
  const baseRowHeights = fullRowHeights.slice(resolvedRowOffsetInSlice);
  if (baseRowHeights.length > 0 && resolvedRowOffsetY > 0) {
    baseRowHeights[0] = Math.max(0, Number(baseRowHeights[0] || 0) - resolvedRowOffsetY);
  }
  const baseOffsetY = sumHeights(fullRowHeights, resolvedRowOffsetInSlice) + resolvedRowOffsetY;

  const sourceMetaLine = lines.find((line) => Array.isArray(getTableSliceMeta(line)?.cells));
  const sourceCells = Array.isArray(getTableSliceMeta(sourceMetaLine)?.cells)
    ? getTableSliceMeta(sourceMetaLine).cells
    : [];

  const cloneLineForSlice = (
    line,
    rowIndexOffset,
    rowHeights,
    relativeYOffset,
    continuation,
    sliceFromPrev,
    sliceHasNext,
    rowSplitFlag
  ) => {
    const lineCopy = {
      ...line,
      runs: Array.isArray(line?.runs) ? line.runs.map((run) => ({ ...run })) : line?.runs,
      blockAttrs: line?.blockAttrs ? { ...line.blockAttrs } : {},
    };
    if (line?.tableOwnerMeta && typeof line.tableOwnerMeta === "object") {
      lineCopy.tableOwnerMeta = { ...line.tableOwnerMeta };
    }
    if (line?.tableMeta && typeof line.tableMeta === "object") {
      lineCopy.tableMeta = { ...line.tableMeta };
    }
    if (Array.isArray(line?.fragmentOwners)) {
      lineCopy.fragmentOwners = line.fragmentOwners.map((owner) => {
        if (!owner || typeof owner !== "object") {
          return owner;
        }
        const nextOwner = {
          ...owner,
          meta: owner?.meta && typeof owner.meta === "object" ? { ...owner.meta } : owner?.meta,
        };
        if (nextOwner.role !== "table" && Number.isFinite(nextOwner?.y)) {
          nextOwner.y = Number(nextOwner.y) - relativeYOffset;
        }
        return nextOwner;
      });
    }

    const originalRowIndex =
      Number.isFinite(lineCopy.blockAttrs?.rowIndex)
        ? Number(lineCopy.blockAttrs.rowIndex)
        : Number.isFinite(lineCopy.tableOwnerMeta?.rowIndex)
          ? Number(lineCopy.tableOwnerMeta.rowIndex)
          : 0;
    const sliceRowIndexValue = Math.max(0, originalRowIndex - rowIndexOffset);
    lineCopy.blockAttrs.rowIndex = originalRowIndex;
    lineCopy.blockAttrs.absoluteRowIndex = originalRowIndex;
    lineCopy.blockAttrs.sliceRowIndex = sliceRowIndexValue;
    lineCopy.blockAttrs.rows = rowHeights.length;
    lineCopy.blockAttrs.cols = cols;
    lineCopy.blockAttrs.rowHeights = rowHeights;
    lineCopy.blockAttrs.colWidth = colWidth;
    lineCopy.blockAttrs.tableWidth = tableWidth;
    lineCopy.blockAttrs.padding = padding;
    lineCopy.blockAttrs.paddingY = paddingY;
    lineCopy.blockAttrs.tableKey = tableKey;
    lineCopy.blockAttrs.sliceGroup = "table";
    lineCopy.blockAttrs.sliceFromPrev = sliceFromPrev === true;
    lineCopy.blockAttrs.sliceHasNext = sliceHasNext === true;
    lineCopy.blockAttrs.sliceRowSplit = rowSplitFlag === true;
    lineCopy.blockAttrs.tableSliceFromPrev = sliceFromPrev === true;
    lineCopy.blockAttrs.tableSliceHasNext = sliceHasNext === true;
    lineCopy.blockAttrs.tableRowSplit = rowSplitFlag === true;
    Object.assign(lineCopy.blockAttrs, createFragmentContinuationAttrs(continuation));

    if (Number.isFinite(lineCopy?.relativeY)) {
      lineCopy.relativeY = Number(lineCopy.relativeY) - relativeYOffset;
    }
    return lineCopy;
  };

  const buildSliceCells = (sliceTop, rowHeights) => {
    if (!Array.isArray(sourceCells) || sourceCells.length === 0) {
      return [];
    }
    const sliceHeight = rowHeights.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const sliceBottom = sliceTop + sliceHeight;
    const result = [];
    for (const cell of sourceCells) {
      const x = Number.isFinite(cell?.x) ? Number(cell.x) : 0;
      const y = Number.isFinite(cell?.y) ? Number(cell.y) : 0;
      const width = Number.isFinite(cell?.width) ? Number(cell.width) : 0;
      const height = Number.isFinite(cell?.height) ? Number(cell.height) : 0;
      if (width <= 0 || height <= 0) {
        continue;
      }
      const top = Math.max(y, sliceTop);
      const bottom = Math.min(y + height, sliceBottom);
      if (!(bottom > top)) {
        continue;
      }
      result.push({
        x,
        y: top - sliceTop,
        width,
        height: bottom - top,
        header: cell?.header === true,
        background: cell?.background ?? null,
      });
    }
    return result;
  };

  const applyTableSliceMeta = (
    sliceLines,
    rowHeights,
    continuation,
    sliceFromPrev,
    sliceHasNext,
    rowSplitFlag,
    sliceBreak,
    sliceTop
  ) => {
    if (!Array.isArray(sliceLines) || sliceLines.length === 0) {
      return;
    }

    const tableHeight = rowHeights.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const tableOwnerMeta = {
      tableKey,
      rows: rowHeights.length,
      cols,
      rowHeights,
      colWidth,
      tableWidth,
      tableHeight,
      padding,
      paddingY,
      cells: buildSliceCells(sliceTop, rowHeights),
      tableTop: 0,
      tableXOffset,
      continuedFromPrev: sliceFromPrev === true,
      continuesAfter: sliceHasNext === true,
      rowSplit: rowSplitFlag === true,
      sliceBreak: sliceBreak === true,
      ...createFragmentContinuationAttrs(continuation),
    };
    const sliceFirstRowIndex = Number.isFinite(continuation?.carryState?.firstRowIndex)
      ? Number(continuation.carryState.firstRowIndex)
      : 0;

    for (const line of sliceLines) {
      line.tableOwnerMeta = tableOwnerMeta;
      if (Array.isArray(line?.fragmentOwners) && line.fragmentOwners.length > 0) {
        let updatedRootOwner = false;
        line.fragmentOwners = line.fragmentOwners.map((owner) => {
          if (!owner || typeof owner !== "object") {
            return owner;
          }
          const nextOwner = {
            ...owner,
            meta: owner?.meta && typeof owner.meta === "object" ? { ...owner.meta } : owner?.meta,
          };
          if (!updatedRootOwner && nextOwner.role === "table") {
            nextOwner.meta = {
              ...(nextOwner.meta || {}),
              ...tableOwnerMeta,
            };
            updatedRootOwner = true;
          } else if (nextOwner.role === "table-row") {
            const absoluteRowIndex = Number.isFinite(nextOwner?.meta?.absoluteRowIndex)
              ? Number(nextOwner.meta.absoluteRowIndex)
              : Number.isFinite(nextOwner?.meta?.rowIndex)
                ? Number(nextOwner.meta.rowIndex)
                : sliceFirstRowIndex;
            const sliceRowIndexValue = Math.max(0, absoluteRowIndex - sliceFirstRowIndex);
            const nextRowHeight = Number(rowHeights?.[sliceRowIndexValue] || 0);
            let nextRowTop = 0;
            for (let index = 0; index < sliceRowIndexValue; index += 1) {
              nextRowTop += Number(rowHeights?.[index] || 0);
            }
            nextOwner.y = nextRowTop;
            nextOwner.height = nextRowHeight;
            nextOwner.width = tableWidth;
            nextOwner.meta = {
              ...(nextOwner.meta || {}),
              rowIndex: absoluteRowIndex,
              absoluteRowIndex,
              sliceRowIndex: sliceRowIndexValue,
              rowHeight: nextRowHeight,
              tableWidth,
            };
          }
          return nextOwner;
        });
      }
    }
  };

  const currentLines = lines.filter((line) => {
    const rowIndex =
      Number.isFinite(line?.blockAttrs?.rowIndex)
        ? Number(line.blockAttrs.rowIndex)
        : Number.isFinite(getTableSliceMeta(line)?.rowIndex)
          ? Number(getTableSliceMeta(line).rowIndex)
          : 0;
    if (rowIndex < resolvedRowOffset) {
      return false;
    }
    if (rowIndex === resolvedRowOffset && resolvedRowOffsetY > 0) {
      const relY = Number.isFinite(line?.relativeY) ? Number(line.relativeY) : 0;
      if (relY < baseOffsetY) {
        return false;
      }
    }
    return true;
  });
  const remainingLength = measureFragmentLength(currentLines, length);
  const effectiveSliceFromPrev =
    typeof inheritedSliceFromPrev === "boolean"
      ? inheritedSliceFromPrev
      : resolvedRowOffset > 0 ||
        resolvedRowOffsetY > 0 ||
        lines.some(
          (line) =>
            line?.blockAttrs?.sliceFromPrev ||
            line?.blockAttrs?.tableSliceFromPrev ||
            getTableSliceMeta(line)?.continuedFromPrev,
        );
  const effectiveRowSplit =
    typeof inheritedRowSplit === "boolean"
      ? inheritedRowSplit
      : resolvedRowOffsetY > 0 ||
        lines.some(
          (line) =>
            line?.blockAttrs?.sliceRowSplit ||
            line?.blockAttrs?.tableRowSplit ||
            getTableSliceMeta(line)?.rowSplit,
        );

  let visibleRowCount = 0;
  let accumulatedHeight = 0;
  for (let i = 0; i < baseRowHeights.length; i += 1) {
    const nextHeight = accumulatedHeight + (Number(baseRowHeights[i]) || 0);
    if (nextHeight > availableHeight) {
      break;
    }
    accumulatedHeight = nextHeight;
    visibleRowCount += 1;
  }

  if (visibleRowCount === 0) {
    const firstRowHeight = Number(baseRowHeights[0]) || 0;
    const fullAvailableHeight = settings
      ? Math.max(0, settings.pageHeight - settings.margin.top - settings.margin.bottom)
      : availableHeight;
    const canFitOnFreshPage =
      fullAvailableHeight > 0 && firstRowHeight > 0 && firstRowHeight <= fullAvailableHeight;
    if (canFitOnFreshPage) {
      const overflowContinuation = createTableContinuation({
        tableKey,
        rows,
        cols,
        firstRowIndex: resolvedRowOffset,
        lastRowIndex: Math.max(resolvedRowOffset, rows - 1),
        rowSplit: effectiveRowSplit,
        continuedFromPrev: effectiveSliceFromPrev,
        continuesAfter: false,
        rowOffsetY: resolvedRowOffsetY,
      });
      return buildTableSplitResult({
        visibleLines: [],
        visibleLength: 0,
        visibleHeight: 0,
        visibleContinuation: null,
        overflowLines: currentLines,
        overflowLength: remainingLength,
        overflowHeight: sumHeights(baseRowHeights),
        overflowContinuation,
      });
    }

    const spacingAllowance = Math.max(0, settings?.blockSpacing || 0);
    const effectiveAvailableHeight = Math.max(0, availableHeight - paddingY);
    const effectiveFullHeight = Math.max(0, fullAvailableHeight - paddingY);
    if (
      firstRowHeight > 0 &&
      fullAvailableHeight > 0 &&
      firstRowHeight > fullAvailableHeight &&
      effectiveAvailableHeight >= effectiveFullHeight - spacingAllowance
    ) {
      const cutHeight = Math.max(1, Math.min(effectiveAvailableHeight, firstRowHeight));
      const cutY = baseOffsetY + cutHeight;
      const visibleLinesRaw = [];
      const overflowLinesRaw = [];
      for (const line of currentLines) {
        const rowIndex = Number.isFinite(line?.blockAttrs?.rowIndex) ? Number(line.blockAttrs.rowIndex) : 0;
        if (rowIndex === resolvedRowOffset) {
          const relY = Number.isFinite(line?.relativeY) ? Number(line.relativeY) : 0;
          if (relY < cutY) {
            visibleLinesRaw.push(line);
          } else {
            overflowLinesRaw.push(line);
          }
          continue;
        }
        overflowLinesRaw.push(line);
      }

      const visibleRowHeights = [cutHeight];
      const overflowRowHeights = [Math.max(0, firstRowHeight - cutHeight), ...baseRowHeights.slice(1)];
      const overflowTotalHeight = sumHeights(overflowRowHeights);
      const needsAnotherSlice = overflowTotalHeight > effectiveFullHeight;
      const visibleContinuation = createTableContinuation({
        tableKey,
        rows,
        cols,
        firstRowIndex: resolvedRowOffset,
        lastRowIndex: resolvedRowOffset,
        rowSplit: true,
        continuedFromPrev: effectiveSliceFromPrev,
        continuesAfter: true,
        rowOffsetY: resolvedRowOffsetY,
      });
      const overflowContinuation = createTableContinuation({
        tableKey,
        rows,
        cols,
        firstRowIndex: resolvedRowOffset,
        lastRowIndex: Math.max(resolvedRowOffset, rows - 1),
        rowSplit: true,
        continuedFromPrev: true,
        continuesAfter: needsAnotherSlice,
        rowOffsetY: resolvedRowOffsetY + cutHeight,
      });

      const visibleLines = visibleLinesRaw.map((line) =>
        cloneLineForSlice(
          line,
          resolvedRowOffset,
          visibleRowHeights,
          baseOffsetY,
          visibleContinuation,
          effectiveSliceFromPrev,
          true,
          true,
        ),
      );
      const overflowLines = overflowLinesRaw.map((line) =>
        cloneLineForSlice(
          line,
          resolvedRowOffset,
          overflowRowHeights,
          cutY,
          overflowContinuation,
          true,
          needsAnotherSlice,
          true,
        ),
      );

      applyTableSliceMeta(
        visibleLines,
        visibleRowHeights,
        visibleContinuation,
        effectiveSliceFromPrev,
        true,
        true,
        false,
        baseOffsetY,
      );
      applyTableSliceMeta(
        overflowLines,
        overflowRowHeights,
        overflowContinuation,
        true,
        needsAnotherSlice,
        true,
        false,
        cutY,
      );

      const visibleStart = visibleLinesRaw.reduce((min, line) => {
        const start = Number.isFinite(line?.start) ? Number(line.start) : 0;
        return Math.min(min, start);
      }, Number.POSITIVE_INFINITY);
      const visibleEnd = visibleLinesRaw.reduce((max, line) => {
        const end = Number.isFinite(line?.end) ? Number(line.end) : 0;
        return Math.max(max, end);
      }, 0);
      const normalizedStart = Number.isFinite(visibleStart) ? visibleStart : 0;
      const visibleLengthInner = Math.max(0, visibleEnd - normalizedStart);
      return buildTableSplitResult({
        visibleLines,
        visibleLength: visibleLengthInner,
        visibleHeight: sumHeights(visibleRowHeights),
        visibleContinuation,
        overflowLines,
        overflowLength: Math.max(0, remainingLength - visibleLengthInner),
        overflowHeight: sumHeights(overflowRowHeights),
        overflowContinuation,
      });
    }

    const overflowContinuation = createTableContinuation({
      tableKey,
      rows,
      cols,
      firstRowIndex: resolvedRowOffset,
      lastRowIndex: Math.max(resolvedRowOffset, rows - 1),
      rowSplit: effectiveRowSplit,
      continuedFromPrev: effectiveSliceFromPrev,
      continuesAfter: false,
      rowOffsetY: resolvedRowOffsetY,
    });
    return buildTableSplitResult({
      visibleLines: [],
      visibleLength: 0,
      visibleHeight: 0,
      visibleContinuation: null,
      overflowLines: currentLines,
      overflowLength: remainingLength,
      overflowHeight: sumHeights(baseRowHeights),
      overflowContinuation,
    });
  }

  const visibleRowHeights = baseRowHeights.slice(0, visibleRowCount);
  const overflowRowHeights = baseRowHeights.slice(visibleRowCount);
  const overflowOffsetY = baseOffsetY + sumHeights(baseRowHeights, visibleRowCount);
  const visibleLinesRaw = [];
  const overflowLinesRaw = [];
  for (const line of currentLines) {
    const rowIndex = Number.isFinite(line?.blockAttrs?.rowIndex)
      ? Number(line.blockAttrs.rowIndex) - resolvedRowOffset
      : 0;
    if (rowIndex < visibleRowCount) {
      visibleLinesRaw.push(line);
    } else {
      overflowLinesRaw.push(line);
    }
  }

  const hasOverflow = overflowLinesRaw.length > 0;
  const visibleContinuation = createTableContinuation({
    tableKey,
    rows,
    cols,
    firstRowIndex: resolvedRowOffset,
    lastRowIndex: Math.max(resolvedRowOffset, resolvedRowOffset + visibleRowHeights.length - 1),
    rowSplit: effectiveRowSplit,
    continuedFromPrev: effectiveSliceFromPrev,
    continuesAfter: hasOverflow,
    rowOffsetY: resolvedRowOffsetY,
  });
  const overflowContinuation = hasOverflow
    ? createTableContinuation({
        tableKey,
        rows,
        cols,
        firstRowIndex: resolvedRowOffset + visibleRowCount,
        lastRowIndex: Math.max(
          resolvedRowOffset + visibleRowCount,
          resolvedRowOffset + visibleRowCount + overflowRowHeights.length - 1,
        ),
        rowSplit: false,
        continuedFromPrev: true,
        continuesAfter: false,
        rowOffsetY: 0,
      })
    : null;

  const visibleLines = visibleLinesRaw.map((line) =>
    cloneLineForSlice(
      line,
      resolvedRowOffset,
      visibleRowHeights,
      baseOffsetY,
      visibleContinuation,
      effectiveSliceFromPrev,
      hasOverflow,
      effectiveRowSplit,
    ),
  );
  const overflowLines = overflowLinesRaw.map((line) =>
    cloneLineForSlice(
      line,
      resolvedRowOffset + visibleRowCount,
      overflowRowHeights,
      overflowOffsetY,
      overflowContinuation,
      true,
      false,
      false,
    ),
  );

  const visibleStart = visibleLinesRaw.reduce((min, line) => {
    const start = Number.isFinite(line?.start) ? Number(line.start) : 0;
    return Math.min(min, start);
  }, Number.POSITIVE_INFINITY);
  const visibleEnd = visibleLinesRaw.reduce((max, line) => {
    const end = Number.isFinite(line?.end) ? Number(line.end) : 0;
    return Math.max(max, end);
  }, 0);
  const normalizedStart = Number.isFinite(visibleStart) ? visibleStart : 0;
  const visibleLength = Math.max(0, visibleEnd - normalizedStart);

  applyTableSliceMeta(
    visibleLines,
    visibleRowHeights,
    visibleContinuation,
    effectiveSliceFromPrev,
    hasOverflow,
    effectiveRowSplit,
    hasOverflow,
    baseOffsetY,
  );
  if (hasOverflow) {
    applyTableSliceMeta(
      overflowLines,
      overflowRowHeights,
      overflowContinuation,
      true,
      false,
      false,
      hasOverflow,
      overflowOffsetY,
    );
  }

  return buildTableSplitResult({
    visibleLines,
    visibleLength,
    visibleHeight: sumHeights(visibleRowHeights),
    visibleContinuation,
    overflowLines,
    overflowLength: hasOverflow ? Math.max(0, remainingLength - visibleLength) : 0,
    overflowHeight: sumHeights(overflowRowHeights),
    overflowContinuation,
  });
};

export const tableRenderer = {
  allowSplit: true,
  cacheLayout: true,
  lineBodyMode: "default-text",
  pagination: {
    fragmentModel: "continuation",
    reusePolicy: "actual-slice-only",
  },
  splitBlock(ctx) {
    return splitTableBlock(ctx);
  },

  measureBlock(ctx: any) {
    const { node, settings, registry } = ctx || {};
    const startPos = Number.isFinite(ctx?.startPos ?? ctx?.blockStart)
      ? Number(ctx?.startPos ?? ctx?.blockStart)
      : 0;
    const layoutResult = this.layoutBlock({ node, settings, registry });
    return buildMeasuredTableModelFromLayout({
      node,
      layoutResult,
      startPos,
    });
  },

  paginateBlock(ctx: any) {
    const measured = ctx?.measured;
    const measuredMeta = measured?.meta || {};
    const fullSnapshot = measuredMeta?.layoutSnapshot || null;
    if (!fullSnapshot || !Array.isArray(fullSnapshot.lines)) {
      return null;
    }

    const cursorState = ctx?.cursor?.localCursor || {};
    const rowIndex = Number.isFinite(cursorState?.rowIndex)
      ? Math.max(0, Number(cursorState.rowIndex))
      : 0;
    const rowOffsetY = Number.isFinite(cursorState?.rowOffsetY)
      ? Math.max(0, Number(cursorState.rowOffsetY))
      : 0;
    const fromPrev = cursorState?.fromPrev === true || rowIndex > 0 || rowOffsetY > 0;
    const rowSplit = cursorState?.rowSplit === true || rowOffsetY > 0;

    const splitResult = splitTableBlock({
      lines: fullSnapshot.lines,
      length: fullSnapshot.length,
      availableHeight: ctx?.availableHeight,
      blockAttrs: fullSnapshot.blockAttrs,
      settings: ctx?.settings,
      sliceRowIndex: rowIndex,
      sliceRowOffsetY: rowOffsetY,
      inheritedSliceFromPrev: fromPrev,
      inheritedRowSplit: rowSplit,
    });
    if (!splitResult) {
      return null;
    }

    const continuation = splitResult?.continuation || null;
    const visibleRange = createTableSliceSnapshot({
      measured,
      snapshot: {
        lines: splitResult.lines,
        length: splitResult.length,
        height: splitResult.height,
        blockAttrs: fullSnapshot.blockAttrs,
        continuation,
      },
      fallbackStartPos: Number(ctx?.cursor?.startPos ?? measured?.startPos ?? 0),
      fallbackEndPos: Number(ctx?.cursor?.startPos ?? measured?.startPos ?? 0),
    });

    const overflowContinuation = splitResult?.overflow?.continuation || null;
    const nextCursor = overflowContinuation
      ? {
          nodeId: measured?.nodeId ?? null,
          blockId: measured?.blockId ?? null,
          startPos: visibleRange.endPos,
          endPos: Number(measured?.endPos ?? visibleRange.endPos),
          localCursor: {
            kind: "table-cursor",
            rowIndex: Number.isFinite(overflowContinuation?.carryState?.firstRowIndex)
              ? Number(overflowContinuation.carryState.firstRowIndex)
              : rowIndex,
            rowOffsetY: Number.isFinite(overflowContinuation?.carryState?.rowOffsetY)
              ? Number(overflowContinuation.carryState.rowOffsetY)
              : 0,
            fromPrev: overflowContinuation?.fromPrev === true,
            rowSplit: overflowContinuation?.rowSplit === true,
          },
          meta: {
            source: "table-modern-paginate",
            fragmentIdentity: overflowContinuation?.fragmentIdentity ?? null,
            continuationToken: overflowContinuation?.continuationToken ?? null,
            fromPrev: overflowContinuation?.fromPrev === true,
            hasNext: overflowContinuation?.hasNext === true,
            rowSplit: overflowContinuation?.rowSplit === true,
          },
        }
      : null;

    return {
      slice: {
        kind: measured?.kind || "table",
        nodeId: measured?.nodeId ?? null,
        blockId: measured?.blockId ?? null,
        startPos: visibleRange.startPos,
        endPos: visibleRange.endPos,
        fromPrev: continuation?.fromPrev === true,
        hasNext: continuation?.hasNext === true || !!nextCursor,
        rowSplit: continuation?.rowSplit === true,
        boxes: [],
        fragments: [],
        lines: Array.isArray(splitResult?.lines) ? splitResult.lines : [],
        nextCursor,
        meta: {
          source: "table-modern-paginate",
          continuation,
          overflowLength: Number(splitResult?.overflow?.length || 0),
        },
      },
      nextCursor,
      exhausted: !nextCursor,
    };
  },

  layoutBlock({ node, settings, registry }) {
    const { rows, cols } = getTableShape(node);
    const tableWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
    const colWidth = tableWidth / cols;
    const padding = 8;
    const paddingY = 10;
    const minRowHeight = Math.max(settings.lineHeight * 1.6, settings.lineHeight + paddingY * 2);

    const rowHeights = [];
    const rowMaxLines = [];
    const rowContentHeights = [];
    const cellLayouts = [];
    const spanCarry = [];
    const tableKey = getNodeFragmentKey(node, "table");
    const tableRootOwner = createTableRootOwner({
      node,
      tableKey,
      settings,
      tableWidth,
      colWidth,
      padding,
      paddingY,
    });
    let tableOffset = 0;

    for (let r = 0; r < rows; r += 1) {
      const row = node.child(r);
      for (let i = 0; i < spanCarry.length; i += 1) {
        if (spanCarry[i] > 0) {
          spanCarry[i] -= 1;
        }
      }

      const rowCells = [];
      let maxContentHeight = 0;
      let logicalCol = 0;

      for (let c = 0; c < row.childCount; c += 1) {
        while (spanCarry[logicalCol] > 0) {
          logicalCol += 1;
        }
        const cell = row.child(c);
        const colspan = Number.isFinite(cell?.attrs?.colspan) ? Math.max(1, cell.attrs.colspan) : 1;
        const rowspan = Number.isFinite(cell?.attrs?.rowspan) ? Math.max(1, cell.attrs.rowspan) : 1;
        if (rowspan > 1) {
          for (let dc = 0; dc < colspan; dc += 1) {
            spanCarry[logicalCol + dc] = Math.max(spanCarry[logicalCol + dc] || 0, rowspan);
          }
        }
        const cellContentWidth = Math.max(0, colWidth * colspan - padding * 2);
        const cellBaseX = settings.margin.left + logicalCol * colWidth + padding;
        const cellLayout = layoutCell(cell, settings, registry, cellContentWidth, cellBaseX);
        const cellLength = cellLayout.length || 0;

        maxContentHeight = Math.max(maxContentHeight, cellLayout.height || 0);

        rowCells.push({
          rowIndex: r,
          colIndex: c,
          colStart: logicalCol,
          colspan,
          rowspan,
          header: cell?.type?.name === "tableHeader",
          background: normalizeTableCellBackground(cell?.attrs?.background),
          startOffset: tableOffset,
          length: cellLength,
          layout: cellLayout,
        });

        tableOffset += cellLength;
        if (c < row.childCount - 1) {
          tableOffset += 1;
        }
        logicalCol += colspan;
      }

      rowContentHeights[r] = maxContentHeight;
      const rowContentHeight = maxContentHeight + paddingY * 2;
      rowHeights[r] = Math.max(rowContentHeight, minRowHeight);
      rowMaxLines[r] = Math.max(1, Math.ceil(maxContentHeight / settings.lineHeight));
      cellLayouts.push(rowCells);

      if (r < rows - 1) {
        tableOffset += 1;
      }
    }

    const lines = [];
    let tableTop = 0;
    const tableHeight = rowHeights.reduce((sum, h) => sum + h, 0);
    const rowTops = [];
    {
      let cursor = 0;
      for (let r = 0; r < rows; r += 1) {
        rowTops[r] = cursor;
        cursor += rowHeights[r] || 0;
      }
    }
    const tableCells = [];
    for (let r = 0; r < rows; r += 1) {
      const rowCells = cellLayouts[r] || [];
      for (const cell of rowCells) {
        const spanRows = Math.max(1, Number.isFinite(cell.rowspan) ? cell.rowspan : 1);
        let cellHeight = 0;
        for (let rr = 0; rr < spanRows; rr += 1) {
          const rowHeight = rowHeights[r + rr];
          if (Number.isFinite(rowHeight)) {
            cellHeight += rowHeight;
          }
        }
        tableCells.push({
          x: (cell.colStart ?? cell.colIndex) * colWidth,
          y: rowTops[r] || 0,
          width: colWidth * Math.max(1, Number.isFinite(cell.colspan) ? cell.colspan : 1),
          height: cellHeight,
          header: cell.header === true,
          background: normalizeTableCellBackground(cell.background),
        });
      }
    }
    const tableOwnerMeta = {
      tableKey,
      rows,
      cols,
      rowHeights,
      cells: tableCells,
      colWidth,
      tableWidth,
      tableHeight,
      padding,
      paddingY,
      tableTop: 0,
      continuedFromPrev: false,
      continuesAfter: false,
      rowSplit: false,
      ...createFragmentContinuationAttrs(
        createTableContinuation({
          tableKey,
          rows,
          cols,
          firstRowIndex: 0,
          lastRowIndex: Math.max(0, rows - 1),
          rowSplit: false,
          continuedFromPrev: false,
          continuesAfter: false,
        })
      ),
    };
    tableRootOwner.meta = {
      ...(tableRootOwner.meta || {}),
      ...tableOwnerMeta,
      layoutCapabilities: {
        ...((tableRootOwner.meta && tableRootOwner.meta.layoutCapabilities) || {}),
        "table-root": true,
        "table-structure": true,
      },
    };

    for (let r = 0; r < rows; r += 1) {
      const rowCells = cellLayouts[r];
      const rowInset = paddingY;
      const rowTop = Number(rowTops[r] || 0);
      const rowHeight = Number(rowHeights[r] || 0);
      const rowOwner = createTableRowOwner({
        tableKey,
        rowIndex: r,
        rowTop,
        rowHeight,
        settings,
        tableWidth,
      });

      for (const cell of rowCells) {
        const cellLines = cell.layout.lines?.length
          ? cell.layout.lines
          : [{ text: "", start: 0, end: 0, width: 0, runs: [] }];
        const cellOwner = createTableCellOwner({
          tableKey,
          cell,
          settings,
          colWidth,
          padding,
        });
        for (let lineIndex = 0; lineIndex < cellLines.length; lineIndex += 1) {
          const cellLine = cellLines[lineIndex];
          const cellLineStart = Number.isFinite(cellLine.start) ? cellLine.start : 0;
          const cellLineEnd = Number.isFinite(cellLine.end) ? cellLine.end : cellLineStart;

          const adjustedRuns = cellLine.runs
            ? cellLine.runs.map((run) => ({
                ...run,
                start: (Number.isFinite(run.start) ? run.start : 0) + cell.startOffset,
                end: (Number.isFinite(run.end) ? run.end : 0) + cell.startOffset,
              }))
            : cellLine.runs;

          const cellBaseX =
            settings.margin.left + (cell.colStart ?? cell.colIndex) * colWidth + padding;
          const shiftedCellOwners = shiftFragmentOwners(
            cellLine.fragmentOwners,
            cellBaseX,
            tableTop + rowInset
          );
          const cellWidthWithSpan = Math.max(0, colWidth * (cell.colspan ?? 1) - padding * 2);
          const lineContinuation = createTableContinuation({
            tableKey,
            rows,
            cols,
            firstRowIndex: r,
            lastRowIndex: r,
            rowSplit: false,
            continuedFromPrev: false,
            continuesAfter: false,
          });
          const lineTableMeta = {
            ...tableOwnerMeta,
            ...createFragmentContinuationAttrs(lineContinuation),
          };
          const line = {
            ...cellLine,
            runs: adjustedRuns,
            start: cell.startOffset + cellLineStart,
            end: cell.startOffset + cellLineEnd,
            blockStart: Number.isFinite(cellLine?.blockStart)
              ? Number(cellLine.blockStart) + cell.startOffset
              : cell.startOffset,
            blockId: cellLine.blockId ?? null,
            x: cellBaseX + (Number.isFinite(cellLine.x) ? cellLine.x : 0),
            relativeY: tableTop + rowInset + (cellLine.relativeY || 0),
            blockType: cellLine.blockType || "table",
            blockAttrs: {
              ...(cellLine.blockAttrs || {}),
              tableKey,
              rows,
              cols,
              rowIndex: r,
              colIndex: cell.colStart ?? cell.colIndex,
              colspan: cell.colspan ?? 1,
              colWidth,
              rowHeights,
              tableWidth,
              padding,
              paddingY,
              sliceGroup: "table",
              sliceFromPrev: false,
              sliceHasNext: false,
              sliceRowSplit: false,
              tableSliceFromPrev: false,
              tableSliceHasNext: false,
              ...createFragmentContinuationAttrs(lineContinuation),
            },
            cellWidth: cellWidthWithSpan,
            cellPadding: padding,
            cellPaddingY: paddingY,
            fragmentOwners: [
              tableRootOwner,
              rowOwner,
              { ...cellOwner, y: tableTop + rowInset },
              ...(shiftedCellOwners || []),
            ],
            tableOwnerMeta: lineTableMeta,
          };

          lines.push(line);
        }
      }

      tableTop += rowHeights[r];
    }

    return {
      lines,
      length: tableOffset,
      height: tableHeight,
      blockType: "table",
      blockAttrs: {
        tableKey,
        rows,
        cols,
        rowHeights,
        colWidth,
        tableWidth,
        padding,
        paddingY,
        sliceGroup: "table",
        sliceFromPrev: false,
        sliceHasNext: false,
        sliceRowSplit: false,
        tableSliceFromPrev: false,
        tableSliceHasNext: false,
        ...createFragmentContinuationAttrs(
          createTableContinuation({
            tableKey,
            rows,
            cols,
            firstRowIndex: 0,
            lastRowIndex: Math.max(0, rows - 1),
            rowSplit: false,
            continuedFromPrev: false,
            continuesAfter: false,
          })
        ),
      },
    };
  },
  renderFragment({ ctx, fragment, pageX, pageTop }) {
    if (fragment?.role !== "table" || !fragment?.meta) {
      return;
    }
    drawTableChrome({
      ctx,
      tableX: pageX + (Number(fragment.x) || 0),
      tableY: pageTop + (Number(fragment.y) || 0),
      tableMeta: fragment.meta,
    });
  },
};









