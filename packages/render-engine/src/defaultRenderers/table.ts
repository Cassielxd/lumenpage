import { breakLines } from "../lineBreaker";
import { docToRuns, textblockToRuns } from "../textRuns";
import { resolveContainerLayoutContext } from "../containerLayout";
import { isLeafLayoutNode } from "../layoutRole";
import { ensureBlockFragmentOwner, hasFragmentOwnerType, shiftFragmentOwners } from "./fragmentOwners";

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

const hasTableFragmentOwner = (line) =>
  hasFragmentOwnerType(line, "table", line?.blockId) ||
  (Array.isArray(line?.fragmentOwners)
    ? line.fragmentOwners.some((owner) => owner?.role === "table")
    : false);

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

export const tableRenderer = {
  allowSplit: true,
  cacheLayout: true,

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
            },
            cellWidth: cellWidthWithSpan,
            cellPadding: padding,
            cellPaddingY: paddingY,
            fragmentOwners: [
              tableRootOwner,
              { ...cellOwner, y: tableTop + rowInset },
              ...(shiftedCellOwners || []),
            ],
            tableOwnerMeta,
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
      },
    };
  },

  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }) {
    const tableMeta = line.tableOwnerMeta || line.tableMeta;
    if (tableMeta && !hasTableFragmentOwner(line)) {
      const tableXOffset = Number.isFinite(tableMeta?.tableXOffset)
        ? tableMeta.tableXOffset
        : 0;
      const tableX = pageX + layout.margin.left + tableXOffset;
      const relativeY = typeof line.relativeY === "number" ? line.relativeY : 0;
      const tableTop = tableMeta.tableTop || 0;
      const tableY = pageTop + line.y - relativeY + tableTop;
      drawTableChrome({ ctx, tableX, tableY, tableMeta });
    }

    defaultRender(line, pageX, pageTop, layout);
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
