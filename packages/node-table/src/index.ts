/*
 * 文件说明：表格节点渲染配置。
 * 主要职责：计算单元格布局、行高与单元格文本 runs。
 */

import { type NodeSpec } from "lumenpage-model";
import { docToRuns } from "lumenpage-view-canvas";

import { breakLines } from "lumenpage-view-canvas";

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

export const serializeTableToText = (tableNode) => {
  const rows = [];

  tableNode.forEach((row) => {
    const cells = [];

    row.forEach((cell) => {
      const cellText = cell.textBetween(0, cell.content.size, "\n");

      cells.push(cellText);
    });

    rows.push(cells.join("\t"));
  });

  return rows.join("\n");
};

export const getTableTextLength = (tableNode) => serializeTableToText(tableNode).length;

export const tableNodeSpecs: Record<string, NodeSpec> = {
  table: {
    group: "block",

    content: "table_row+",

    attrs: {
      id: { default: null },
    },

    parseDOM: [
      {
        tag: "table",

        getAttrs: (dom) => ({ id: readIdAttr(dom) }),
      },
    ],

    toDOM(node) {
      const attrs = {};

      if (node.attrs?.id) {
        attrs["data-node-id"] = node.attrs.id;
      }

      return ["table", attrs, ["tbody", 0]];
    },
  },

  table_row: {
    content: "table_cell+",

    parseDOM: [{ tag: "tr" }],

    toDOM() {
      return ["tr", 0];
    },
  },

  table_cell: {
    content: "paragraph+",

    parseDOM: [{ tag: "td" }, { tag: "th" }],

    toDOM() {
      return ["td", 0];
    },
  },
};

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

const sumHeights = (rows, count?: number) => {
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

    settings.measureTextWidth,
    settings.segmentText
  );

  if (lines.length === 0) {
    lines.push({ text: "", start: 0, end: 0, width: 0, runs: [] });
  }

  return { lines, length };
};

export const tableRenderer = {
  allowSplit: true,

  /* 񲼾֣㵥Ԫıиߣɱб */

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
              tableSliceFromPrev: false,
              tableSliceHasNext: false,
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

      blockAttrs: {
        rows,
        cols,
        rowHeights,
        colWidth,
        tableWidth,
        padding,
        paddingY,
        tableSliceFromPrev: false,
        tableSliceHasNext: false,
      },
    };
  },

  splitBlock({ lines, length, availableHeight, blockAttrs }) {
    if (!lines || lines.length === 0) {
      return null;
    }

    const firstAttrs = lines[0].blockAttrs || {};

    let fullRowHeights = Array.isArray(firstAttrs.rowHeights) ? firstAttrs.rowHeights : [];
    if (fullRowHeights.length === 0) {
      const fallbackLine = lines.find((line) => Array.isArray(line?.blockAttrs?.rowHeights));
      if (fallbackLine?.blockAttrs?.rowHeights) {
        fullRowHeights = fallbackLine.blockAttrs.rowHeights;
      }
    }
    if (fullRowHeights.length === 0 && Array.isArray(blockAttrs?.rowHeights)) {
      fullRowHeights = blockAttrs.rowHeights;
    }
    if (fullRowHeights.length === 0 && Array.isArray(lines[0]?.tableMeta?.rowHeights)) {
      fullRowHeights = lines[0].tableMeta.rowHeights;
    }

    if (fullRowHeights.length === 0) {
      return null;
    }

    const cols = Number.isFinite(firstAttrs.cols) ? firstAttrs.cols : 0;

    const colWidth = Number.isFinite(firstAttrs.colWidth) ? firstAttrs.colWidth : 0;

    const tableWidth = Number.isFinite(firstAttrs.tableWidth) ? firstAttrs.tableWidth : 0;

    const padding = Number.isFinite(firstAttrs.padding) ? firstAttrs.padding : 0;

    const paddingY =
      Number.isFinite(firstAttrs.paddingY) ? firstAttrs.paddingY : blockAttrs?.paddingY ?? 0;

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
      const fullHeight = sumHeights(baseRowHeights);
      return {
        lines: [],
        length: 0,
        height: 0,
        overflow: {
          lines,
          length,
          height: fullHeight,
        },
      };
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

      const remapLines = (
        sourceLines,
        rowIndexOffset,
        rowHeights,
        relativeYOffset,
        sliceFromPrev,
        sliceHasNext
      ) =>
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
          attrs.tableSliceFromPrev = !!sliceFromPrev;
          attrs.tableSliceHasNext = !!sliceHasNext;

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

        baseOffsetY,
        resolvedRowOffset > 0,
        overflowRowHeights.length > 0
      );

      const overflowLines = remapLines(
        overflowLinesRaw,

        resolvedRowOffset + visibleRowCount,

        overflowRowHeights,

        overflowOffsetY,
        true,
        false
      );

      const applyTableMeta = (sliceLines, rowHeights, sliceFromPrev, sliceHasNext) => {
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
          continuedFromPrev: !!sliceFromPrev,
          continuesAfter: !!sliceHasNext,
        };
      };

      applyTableMeta(
        visibleLines,
        visibleRowHeights,
        resolvedRowOffset > 0,
        overflowRowHeights.length > 0
      );

      applyTableMeta(overflowLines, overflowRowHeights, true, false);

    const visibleStart = visibleLinesRaw.reduce((min, line) => {
      const start = Number.isFinite(line.start) ? line.start : 0;
      return Math.min(min, start);
    }, Number.POSITIVE_INFINITY);
    const visibleEnd = visibleLinesRaw.reduce((max, line) => {
      const end = Number.isFinite(line.end) ? line.end : 0;
      return Math.max(max, end);
    }, 0);
    const normalizedStart = Number.isFinite(visibleStart) ? visibleStart : 0;
    const visibleLength = Math.max(0, visibleEnd - normalizedStart);

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

  /* ȾıԸĬȾ */

  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }) {
      if (line.tableMeta) {
        const tableX = pageX + layout.margin.left;

        const relativeY = typeof line.relativeY === "number" ? line.relativeY : 0;

        const tableTop = line.tableMeta.tableTop || 0;

        const tableY = pageTop + line.y - relativeY + tableTop;

        const {
          rows,
          cols,
          rowHeights,
          tableWidth,
          colWidth,
          tableHeight,
          continuedFromPrev,
          continuesAfter,
        } = line.tableMeta;

        ctx.save();

        ctx.strokeStyle = "#6b7280";

        ctx.lineWidth = 1;

        ctx.beginPath();
        // outer borders
        ctx.moveTo(tableX, tableY);
        ctx.lineTo(tableX, tableY + tableHeight);
        ctx.moveTo(tableX + tableWidth, tableY);
        ctx.lineTo(tableX + tableWidth, tableY + tableHeight);
        if (!continuedFromPrev) {
          ctx.moveTo(tableX, tableY);
          ctx.lineTo(tableX + tableWidth, tableY);
        }
        if (!continuesAfter) {
          ctx.moveTo(tableX, tableY + tableHeight);
          ctx.lineTo(tableX + tableWidth, tableY + tableHeight);
        }
        ctx.stroke();

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



