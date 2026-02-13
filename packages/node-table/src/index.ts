/*
 * 文件说明：表格节点渲染器。
 * 主要职责：计算表格单元格布局与行高；绘制表格网格与文本行。
 */

import { docToRuns } from "lumenpage-core";

import { breakLines } from "lumenpage-core";

const getTableShape = (node) => {
  const rows = node.childCount;

  let cols = 0;

  node.forEach((row) => {
    cols = Math.max(cols, row.childCount);
  });

  return {
    rows: Math.max(1, rows),

    cols: Math.max(1, cols),
  };
};

const getCellTextLength = (cell) =>
  cell ? cell.textBetween(0, cell.content.size, "\n").length : 0;

const sumHeights = (rows, count) => {
  const limit = Math.min(count ?? rows.length, rows.length);
  let total = 0;
  for (let i = 0; i < limit; i += 1) {
    total += rows[i];
  }
  return total;
};

const layoutCell = (cell, settings, registry, maxWidth) => {
  if (!cell) {
    return { lines: [{ text: "", start: 0, end: 0, width: 0, runs: [] }], length: 0 };
  }

  const { runs, length } = docToRuns(cell, settings, registry);

  const lines = breakLines(
    runs,

    maxWidth,

    settings.font,

    length,

    settings.wrapTolerance || 0,

    settings.minLineWidth || 0,

    settings.measureTextWidth
  );

  if (lines.length === 0) {
    lines.push({ text: "", start: 0, end: 0, width: 0, runs: [] });
  }

  return { lines, length };
};

export const tableRenderer = {
  allowSplit: true,

  /* 表格布局：计算单元格文本行与行高，生成表格块行列表 */

  layoutBlock({ node, settings, registry }) {
    const { rows, cols } = getTableShape(node);

    const tableWidth = settings.pageWidth - settings.margin.left - settings.margin.right;

    const colWidth = tableWidth / cols;

    const padding = 8;

    const paddingY = 10;

    const minRowHeight = Math.max(settings.lineHeight * 1.6, settings.lineHeight + paddingY * 2);

    const maxCellWidth = Math.max(0, colWidth - padding * 2);

    const rowHeights = [];

    const rowMaxLines = [];

    const cellLayouts = [];

    let tableOffset = 0;

    for (let r = 0; r < rows; r += 1) {
      const row = node.child(r);

      const rowCells = [];

      let maxLines = 1;

      for (let c = 0; c < cols; c += 1) {
        const cell = c < row.childCount ? row.child(c) : null;

        const cellLayout = layoutCell(cell, settings, registry, maxCellWidth);

        const cellLength = getCellTextLength(cell);

        maxLines = Math.max(maxLines, cellLayout.lines.length || 1);

        rowCells.push({
          rowIndex: r,

          colIndex: c,

          startOffset: tableOffset,

          length: cellLength,

          layout: cellLayout,
        });

        tableOffset += cellLength;

        if (c < cols - 1) {
          tableOffset += 1;
        }
      }

      rowHeights[r] = Math.max(
        maxLines * settings.lineHeight + paddingY * 2,

        minRowHeight
      );

      rowMaxLines[r] = maxLines;

      cellLayouts.push(rowCells);

      if (r < rows - 1) {
        tableOffset += 1;
      }
    }

    const lines = [];

    let tableTop = 0;

    const tableHeight = rowHeights.reduce((sum, h) => sum + h, 0);

    for (let r = 0; r < rows; r += 1) {
      const rowCells = cellLayouts[r];

      const maxLines = Math.max(1, rowMaxLines[r] || 1);

      const rowContentHeight = maxLines * settings.lineHeight + paddingY * 2;

      const rowExtra = Math.max(0, rowHeights[r] - rowContentHeight);

      const rowInset = paddingY + rowExtra / 2;

      for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {
        for (const cell of rowCells) {
          const cellLine = cell.layout.lines[lineIndex] || {
            text: "",

            start: 0,

            end: 0,

            width: 0,

            runs: [],
          };

          const cellLineStart = Number.isFinite(cellLine.start) ? cellLine.start : 0;

          const cellLineEnd = Number.isFinite(cellLine.end) ? cellLine.end : cellLineStart;

          const adjustedRuns = cellLine.runs
            ? cellLine.runs.map((run) => ({
                ...run,

                start: (Number.isFinite(run.start) ? run.start : 0) + cell.startOffset,

                end: (Number.isFinite(run.end) ? run.end : 0) + cell.startOffset,
              }))
            : cellLine.runs;

          const line = {
            ...cellLine,

            runs: adjustedRuns,

            start: cell.startOffset + cellLineStart,

            end: cell.startOffset + cellLineEnd,

            x: settings.margin.left + cell.colIndex * colWidth + padding,

            relativeY: tableTop + rowInset + lineIndex * settings.lineHeight,

            blockType: "table",

            blockAttrs: {
              rows,

              cols,

              rowIndex: r,

              colIndex: cell.colIndex,

              colWidth,

              rowHeights,

              tableWidth,

              padding,

              paddingY,
            },

            cellWidth: maxCellWidth,

            cellPadding: padding,

            cellPaddingY: paddingY,
          };

          if (r === 0 && cell.colIndex === 0 && lineIndex === 0) {
            line.tableMeta = {
              rows,

              cols,

              rowHeights,

              colWidth,

              tableWidth,

              tableHeight,

              padding,

              paddingY,

              tableTop: 0,
            };
          }

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

      blockAttrs: { rows, cols, rowHeights, colWidth, tableWidth, padding },
    };
  },

  splitBlock({ lines, length, availableHeight }) {
    if (!lines || lines.length === 0) {
      return null;
    }

    const firstAttrs = lines[0].blockAttrs || {};

    const fullRowHeights = Array.isArray(firstAttrs.rowHeights) ? firstAttrs.rowHeights : [];

    if (fullRowHeights.length === 0) {
      return null;
    }

    const cols = Number.isFinite(firstAttrs.cols) ? firstAttrs.cols : 0;

    const colWidth = Number.isFinite(firstAttrs.colWidth) ? firstAttrs.colWidth : 0;

    const tableWidth = Number.isFinite(firstAttrs.tableWidth) ? firstAttrs.tableWidth : 0;

    const padding = Number.isFinite(firstAttrs.padding) ? firstAttrs.padding : 0;

    const paddingY = Number.isFinite(firstAttrs.paddingY) ? firstAttrs.paddingY : 0;

    const rowOffset = lines.reduce((minRow, line) => {
      const rowIndex = line.blockAttrs?.rowIndex;

      if (!Number.isFinite(rowIndex)) {
        return minRow;
      }

      return Math.min(minRow, rowIndex);
    }, Number.POSITIVE_INFINITY);

    const resolvedRowOffset = Number.isFinite(rowOffset) ? rowOffset : 0;

    const baseRowHeights =
      resolvedRowOffset > 0 ? fullRowHeights.slice(resolvedRowOffset) : fullRowHeights;

    const baseOffsetY = resolvedRowOffset > 0 ? sumHeights(fullRowHeights, resolvedRowOffset) : 0;

    let visibleRowCount = 0;

    let accumulatedHeight = 0;

    for (let i = 0; i < baseRowHeights.length; i += 1) {
      const next = accumulatedHeight + baseRowHeights[i];

      if (next > availableHeight) {
        break;
      }

      accumulatedHeight = next;

      visibleRowCount += 1;
    }

    if (visibleRowCount === 0) {
      return null;
    }

    const visibleRowHeights = baseRowHeights.slice(0, visibleRowCount);

    const overflowRowHeights = baseRowHeights.slice(visibleRowCount);

    const overflowOffsetY = baseOffsetY + sumHeights(baseRowHeights, visibleRowCount);

    const visibleLinesRaw = [];

    const overflowLinesRaw = [];

    for (const line of lines) {
      const rowIndex = Number.isFinite(line.blockAttrs?.rowIndex)
        ? line.blockAttrs.rowIndex - resolvedRowOffset
        : 0;

      if (rowIndex < visibleRowCount) {
        visibleLinesRaw.push(line);
      } else {
        overflowLinesRaw.push(line);
      }
    }

    const remapLines = (sourceLines, rowIndexOffset, rowHeights, relativeYOffset) =>
      sourceLines.map((line) => {
        const { tableMeta: _tableMeta, ...lineCopy } = line;

        const attrs = lineCopy.blockAttrs ? { ...lineCopy.blockAttrs } : {};

        const originalRowIndex = Number.isFinite(attrs.rowIndex) ? attrs.rowIndex : 0;

        attrs.rowIndex = Math.max(0, originalRowIndex - rowIndexOffset);

        attrs.rowHeights = rowHeights;

        attrs.rows = rowHeights.length;

        attrs.cols = cols;

        attrs.colWidth = colWidth;

        attrs.tableWidth = tableWidth;

        attrs.padding = padding;

        attrs.paddingY = paddingY;

        lineCopy.blockAttrs = attrs;

        if (typeof lineCopy.relativeY === "number") {
          lineCopy.relativeY = lineCopy.relativeY - relativeYOffset;
        }

        return lineCopy;
      });

    const visibleLines = remapLines(
      visibleLinesRaw,

      resolvedRowOffset,

      visibleRowHeights,

      baseOffsetY
    );

    const overflowLines = remapLines(
      overflowLinesRaw,

      resolvedRowOffset + visibleRowCount,

      overflowRowHeights,

      overflowOffsetY
    );

    const applyTableMeta = (sliceLines, rowHeights) => {
      if (sliceLines.length === 0) {
        return;
      }

      const tableHeight = rowHeights.reduce((sum, h) => sum + h, 0);

      sliceLines[0].tableMeta = {
        rows: rowHeights.length,

        cols,

        rowHeights,

        colWidth,

        tableWidth,

        tableHeight,

        padding,

        paddingY,

        tableTop: 0,
      };
    };

    applyTableMeta(visibleLines, visibleRowHeights);

    applyTableMeta(overflowLines, overflowRowHeights);

    const visibleLength = visibleLinesRaw.reduce((max, line) => {
      return Number.isFinite(line.end) ? Math.max(max, line.end) : max;
    }, 0);

    const visibleHeight = sumHeights(visibleRowHeights);

    const overflowHeight = sumHeights(overflowRowHeights);

    return {
      lines: visibleLines,

      length: visibleLength,

      height: visibleHeight,

      overflow: overflowLines.length
        ? {
            lines: overflowLines,

            length: Math.max(0, length - visibleLength),

            height: overflowHeight,
          }
        : undefined,
    };
  },

  /* 表格渲染：绘制网格，文本仍复用默认渲染 */

  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }) {
    if (line.tableMeta) {
      const tableX = pageX + layout.margin.left;

      const relativeY = typeof line.relativeY === "number" ? line.relativeY : 0;

      const tableTop = line.tableMeta.tableTop || 0;

      const tableY = pageTop + line.y - relativeY + tableTop;

      const { rows, cols, rowHeights, tableWidth, colWidth, tableHeight } = line.tableMeta;

      ctx.save();

      ctx.strokeStyle = "#6b7280";

      ctx.lineWidth = 1;

      ctx.strokeRect(tableX, tableY, tableWidth, tableHeight);

      let y = tableY;

      for (let r = 0; r < rows - 1; r += 1) {
        y += rowHeights[r];

        ctx.beginPath();

        ctx.moveTo(tableX, y);

        ctx.lineTo(tableX + tableWidth, y);

        ctx.stroke();
      }

      for (let c = 1; c < cols; c += 1) {
        const x = tableX + c * colWidth;

        ctx.beginPath();

        ctx.moveTo(x, tableY);

        ctx.lineTo(x, tableY + tableHeight);

        ctx.stroke();
      }

      ctx.restore();
    }

    defaultRender(line, pageX, pageTop, layout);
  },
};
