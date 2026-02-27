/*
 * 鏂囦欢璇存槑锛氳〃鏍艰妭鐐规覆鏌撻厤缃€? * 涓昏鑱岃矗锛氳绠楀崟鍏冩牸甯冨眬銆佽楂樹笌鍗曞厓鏍兼枃鏈?runs銆? */

import { type NodeSpec } from "lumenpage-model";
import { NodeSelection } from "lumenpage-state";
import {
  docToRuns,
  textblockToRuns,
  breakLines,
} from "lumenpage-view-canvas";
import { splitTableBlock } from "./pagination/split";
export {
  addTableRowAfter,
  addTableRowBefore,
  deleteTableRow,
  addTableColumnAfter,
  addTableColumnBefore,
  deleteTableColumn,
  goToNextTableCell,
  goToPreviousTableCell,
  enterTableCellSelection,
  deleteTableCellSelection,
  preventDeleteBackwardAtTableCellBoundary,
  preventDeleteForwardAtTableCellBoundary,
  mergeTableCellRight,
  splitTableCell,
  selectCurrentAndNextTableCell,
  selectCurrentAndBelowTableCell,
  mergeSelectedTableCells,
} from "./commands";
export { CellSelection } from "./cellSelection";

const isInTableAtResolvedPos = ($pos) => {
  if (!$pos || !Number.isFinite($pos.depth)) {
    return false;
  }
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const typeName = $pos.node(depth)?.type?.name;
    if (typeName === "table" || typeName === "table_row" || typeName === "table_cell") {
      return true;
    }
  }
  return false;
};

export const createTableSelectionGeometry = () => ({
  shouldComputeSelectionRects: ({ editorState, selection }) => {
    const pmSel = editorState?.selection;
    if (!pmSel) {
      return false;
    }
    if (pmSel?.$anchorCell || pmSel?.$headCell || pmSel?.constructor?.name === "CellSelection") {
      return true;
    }
    if (pmSel instanceof NodeSelection) {
      return pmSel.node?.type?.name === "table";
    }
    if (!selection || selection.from === selection.to) {
      return false;
    }
    return isInTableAtResolvedPos(pmSel?.$from) || isInTableAtResolvedPos(pmSel?.$to);
  },
  shouldRenderBorderOnly: ({ editorState }) => {
    const selection = editorState?.selection;
    return selection instanceof NodeSelection && selection.node?.type?.name === "table";
  },
});

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

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

const getFontSize = (font) => {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || "");
  if (!match) {
    return 16;
  }
  const size = Number.parseFloat(match[1]);
  return Number.isFinite(size) ? size : 16;
};

const resolveListMarker = (line, layout) => {
  if (line.listMarker) {
    return line.listMarker;
  }
  const attrs = line.blockAttrs || {};
  if (!attrs.markerText || !Number.isFinite(attrs.markerWidth)) {
    return null;
  }
  if (attrs.markerGap == null) {
    return null;
  }
  if (line.blockStart != null && line.start != null && line.blockStart !== line.start) {
    return null;
  }
  return {
    text: attrs.markerText,
    width: attrs.markerWidth,
    gap: attrs.markerGap,
    font: attrs.markerFont || layout.font,
  };
};

const renderListMarker = ({ ctx, line, pageX, pageTop, layout }) => {
  const marker = resolveListMarker(line, layout);
  if (!marker) {
    return;
  }
  const fontSpec = marker.font || layout.font;
  const fontSize = getFontSize(fontSpec);
  const lineHeight = getLineHeight(line, layout);
  const baselineOffset = Math.max(0, (lineHeight - fontSize) / 2);
  const markerX = pageX + line.x - marker.gap - marker.width;
  const markerY = pageTop + line.y + baselineOffset;

  if (ctx.fillText) {
    ctx.font = fontSpec;
    ctx.fillStyle = "#111827";
    ctx.fillText(marker.text, markerX, markerY);
    return;
  }

  if (ctx.fillRect) {
    const size = Math.max(4, Math.round(fontSize * 0.35));
    ctx.fillRect(markerX, markerY + (fontSize - size) / 2, size, size);
  }
};

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

const serializeCellToText = (cell, helpers) => {
  if (!cell || cell.childCount === 0) {
    return "";
  }
  const parts = [];
  for (let i = 0; i < cell.childCount; i += 1) {
    parts.push(helpers?.serializeNodeToText ? helpers.serializeNodeToText(cell.child(i)) : "");
    if (i < cell.childCount - 1) {
      parts.push("\n");
    }
  }
  return parts.join("");
};

const getCellTextLength = (cell, helpers) => {
  if (!cell || cell.childCount === 0) {
    return 0;
  }
  let length = 0;
  for (let i = 0; i < cell.childCount; i += 1) {
    if (helpers?.getNodeTextLength) {
      length += helpers.getNodeTextLength(cell.child(i));
    } else {
      length += cell.child(i).textContent.length;
    }
    if (i < cell.childCount - 1) {
      length += 1;
    }
  }
  return length;
};

const mapOffsetInCell = (cell, cellPos, offset, helpers) => {
  let remaining = offset;
  let innerPos = cellPos + 1;
  for (let i = 0; i < cell.childCount; i += 1) {
    const block = cell.child(i);
    const blockPos = innerPos;
    const textLength = helpers?.getNodeTextLength
      ? helpers.getNodeTextLength(block)
      : block.textContent.length;
    if (remaining <= textLength) {
      return helpers?.mapOffsetInNode
        ? helpers.mapOffsetInNode(block, blockPos, remaining)
        : blockPos + Math.max(0, remaining);
    }
    remaining -= textLength;
    if (i < cell.childCount - 1) {
      if (remaining === 0) {
        return blockPos + block.nodeSize - 1;
      }
      remaining -= 1;
    }
    innerPos += block.nodeSize;
  }
  return cellPos + cell.nodeSize - 1;
};

const mapPosInCell = (cell, cellPos, pos, helpers) => {
  let offset = 0;
  let innerPos = cellPos + 1;
  for (let i = 0; i < cell.childCount; i += 1) {
    const block = cell.child(i);
    const blockPos = innerPos;
    if (pos <= blockPos) {
      return offset;
    }
    if (pos < blockPos + block.nodeSize) {
      return helpers?.mapPosInNode ? offset + helpers.mapPosInNode(block, blockPos, pos) : offset;
    }
    offset += helpers?.getNodeTextLength
      ? helpers.getNodeTextLength(block)
      : block.textContent.length;
    if (i < cell.childCount - 1) {
      offset += 1;
    }
    innerPos += block.nodeSize;
  }
  return offset;
};

const tableOffsetMapping = {
  toText: (tableNode, helpers) => {
    const rows = [];
    tableNode.forEach((row) => {
      const cells = [];
      row.forEach((cell) => {
        if (helpers?.serializeNodeToText) {
          cells.push(serializeCellToText(cell, helpers));
        } else {
          cells.push(cell.textBetween(0, cell.content.size, "\n"));
        }
      });
      rows.push(cells.join("\t"));
    });
    return rows.join("\n");
  },
  getTextLength: (tableNode, helpers) => {
    let length = 0;
    tableNode.forEach((row, _rowPos, rowIndex) => {
      row.forEach((cell, _cellPos, cellIndex) => {
        length += helpers?.getNodeTextLength
          ? getCellTextLength(cell, helpers)
          : cell.textBetween(0, cell.content.size, "\n").length;
        if (cellIndex < row.childCount - 1) {
          length += 1;
        }
      });
      if (rowIndex < tableNode.childCount - 1) {
        length += 1;
      }
    });
    return length;
  },
  mapOffsetToPos: (table, tablePos, offset, helpers) => {
    let remaining = offset;
    let rowPos = tablePos + 1;
    for (let r = 0; r < table.childCount; r += 1) {
      const row = table.child(r);
      const rowStart = rowPos + 1;
      let cellPos = rowStart;
      for (let c = 0; c < row.childCount; c += 1) {
        const cell = row.child(c);
        const cellLength = getCellTextLength(cell, helpers);
        if (remaining <= cellLength) {
          return mapOffsetInCell(cell, cellPos, remaining, helpers);
        }
        remaining -= cellLength;
        if (c < row.childCount - 1) {
          if (remaining === 0) {
            return cellPos + cell.nodeSize - 1;
          }
          remaining -= 1;
        }
        cellPos += cell.nodeSize;
      }
      if (r < table.childCount - 1) {
        if (remaining === 0) {
          return rowPos + row.nodeSize - 1;
        }
        remaining -= 1;
      }
      rowPos += row.nodeSize;
    }
    return tablePos + table.nodeSize - 1;
  },
  mapPosToOffset: (table, tablePos, pos, helpers) => {
    let offset = 0;
    let rowPos = tablePos + 1;
    for (let r = 0; r < table.childCount; r += 1) {
      const row = table.child(r);
      const rowStart = rowPos + 1;
      let cellPos = rowStart;
      for (let c = 0; c < row.childCount; c += 1) {
        const cell = row.child(c);
        if (pos <= cellPos) {
          return offset;
        }
        if (pos < cellPos + cell.nodeSize) {
          return offset + mapPosInCell(cell, cellPos, pos, helpers);
        }
        offset += getCellTextLength(cell, helpers);
        if (c < row.childCount - 1) {
          offset += 1;
        }
        cellPos += cell.nodeSize;
      }
      if (r < table.childCount - 1) {
        offset += 1;
      }
      rowPos += row.nodeSize;
    }
    return offset;
  },
};

export const tableNodeSpecs: Record<string, NodeSpec> = {
  table: {
    group: "block",

    content: "table_row+",

    attrs: {
      id: { default: null },
    },
    offsetMapping: tableOffsetMapping,

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
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      header: { default: false },
      background: { default: null },
    },

    content: "block+",
    isolating: true,

    parseDOM: [
      {
        tag: "td",
        getAttrs: (dom) => ({
          colspan: Math.max(1, Number.parseInt(dom.getAttribute("colspan") || "1", 10) || 1),
          rowspan: Math.max(1, Number.parseInt(dom.getAttribute("rowspan") || "1", 10) || 1),
          header: false,
          background: normalizeTableCellBackground(
            dom.style?.backgroundColor || dom.getAttribute("data-background")
          ),
        }),
      },
      {
        tag: "th",
        getAttrs: (dom) => ({
          colspan: Math.max(1, Number.parseInt(dom.getAttribute("colspan") || "1", 10) || 1),
          rowspan: Math.max(1, Number.parseInt(dom.getAttribute("rowspan") || "1", 10) || 1),
          header: true,
          background: normalizeTableCellBackground(
            dom.style?.backgroundColor || dom.getAttribute("data-background")
          ),
        }),
      },
    ],

    toDOM(node) {
      const attrs: Record<string, string | number> = {};
      const colspan = Number.isFinite(node.attrs?.colspan) ? node.attrs.colspan : 1;
      const rowspan = Number.isFinite(node.attrs?.rowspan) ? node.attrs.rowspan : 1;
      if (colspan > 1) {
        attrs.colspan = colspan;
      }
      if (rowspan > 1) {
        attrs.rowspan = rowspan;
      }
      const background = normalizeTableCellBackground(node.attrs?.background);
      if (background) {
        attrs.style = `background-color:${background}`;
        attrs["data-background"] = background;
      }
      const isHeader = node.attrs?.header === true;
      return [isHeader ? "th" : "td", attrs, 0];
    },
  },
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

const offsetLine = (line, delta) => {
  if (typeof line.start === "number") {
    line.start += delta;
  }
  if (typeof line.end === "number") {
    line.end += delta;
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
        ? textblockToRuns(node, blockSettings, node.type.name, blockId, node.attrs, 0)
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
    if (lineCopy.tableMeta && Number.isFinite(cellBaseX)) {
      lineCopy.tableMeta = {
        ...lineCopy.tableMeta,
        tableXOffset: (lineCopy.tableMeta.tableXOffset ?? 0) + cellBaseX,
      };
    }
    applyContainerStack(lineCopy, context.containerStack);
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
  const isLeaf = renderer?.layoutBlock || renderer?.toRuns || node.isTextblock || node.isAtom;

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

  const style = renderer?.getContainerStyle
    ? renderer.getContainerStyle({ node, settings, registry })
    : null;
  const indent = Number.isFinite(style?.indent) ? style.indent : 0;
  const shouldPush = indent > 0 || renderer?.renderContainer || style;
  const nextContext = shouldPush
    ? {
        indent: context.indent + indent,
        containerStack: [
          ...context.containerStack,
          {
            ...style,
            type: node.type.name,
            offset: context.indent,
            indent,
            baseX: cellBaseX + context.indent,
          },
        ],
      }
    : context;

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

export const tableRenderer = {
  allowSplit: true,
  // Block cache can stay enabled: model-level node hash includes descendant cell attrs.
  cacheLayout: true,

  /* 癫季郑愕ピ毙高Ｉ毙?*/

  layoutBlock({ node, settings, registry }) {
    const { rows, cols } = getTableShape(node);

    const tableWidth = settings.pageWidth - settings.margin.left - settings.margin.right;

    const colWidth = tableWidth / cols;

    const padding = 8;

    const paddingY = 10;

    const minRowHeight = Math.max(settings.lineHeight * 1.6, settings.lineHeight + paddingY * 2);

    const maxCellWidth = Math.max(0, colWidth - padding * 2);

    // Row metrics used by pagination/splitting.
    const rowHeights = [];
    const rowMaxLines = [];
    const rowContentHeights = [];

    // Cache per-cell layouts for row split operations.
    const cellLayouts = [];
    const spanCarry: number[] = [];

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

        // 琛岄珮搴︾敱鏈鍐呮渶楂樼殑 cell 鍐呭鍐冲畾
        maxContentHeight = Math.max(maxContentHeight, cellLayout.height || 0);

        rowCells.push({
          rowIndex: r,

          colIndex: c,
          colStart: logicalCol,
          colspan,
          rowspan,
          header: cell?.attrs?.header === true,
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

      // 璁板綍琛屽唴瀹归珮搴︼紙涓嶅惈涓婁笅 padding锛?      rowContentHeights[r] = maxContentHeight;

      const rowContentHeight = maxContentHeight + paddingY * 2;
      rowHeights[r] = Math.max(rowContentHeight, minRowHeight);
      rowMaxLines[r] = Math.max(1, Math.ceil(maxContentHeight / settings.lineHeight));

      cellLayouts.push(rowCells);

      if (r < rows - 1) {
        tableOffset += 1;
      }
    }

    // Build renderable lines with mapped cell positions.
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

    for (let r = 0; r < rows; r += 1) {
      const rowCells = cellLayouts[r];

      const maxLines = Math.max(1, rowMaxLines[r] || 1);
      const rowContentHeight =
        Math.max(Number.isFinite(rowContentHeights[r]) ? rowContentHeights[r] : 0, 0) +
        paddingY * 2;

      const rowExtra = Math.max(0, rowHeights[r] - rowContentHeight);

      const fullAvailableHeight = Math.max(
        0,
        settings.pageHeight - settings.margin.top - settings.margin.bottom
      );

      // 褰撳崟琛岃秴杩囨暣椤甸珮搴︽椂锛岄《绔榻愶紙閬垮厤灞呬腑瀵艰嚧鍒囧垎浣嶇疆涓嶇ǔ瀹氾級
      const shouldTopAlign = fullAvailableHeight > 0 && rowHeights[r] > fullAvailableHeight;

      // Keep cell content top-aligned for stable baseline/caret behavior.
      const rowInset = paddingY;

      for (const cell of rowCells) {
        const cellLines = cell.layout.lines?.length
          ? cell.layout.lines
          : [{ text: "", start: 0, end: 0, width: 0, runs: [] }];
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
          const cellWidthWithSpan = Math.max(0, colWidth * (cell.colspan ?? 1) - padding * 2);
          const line = {
            ...cellLine,
            runs: adjustedRuns,
            start: cell.startOffset + cellLineStart,
            end: cell.startOffset + cellLineEnd,
            blockStart: null,
            blockId: null,
            x: cellBaseX + (Number.isFinite(cellLine.x) ? cellLine.x : 0),
            relativeY: tableTop + rowInset + (cellLine.relativeY || 0),
            blockType: "table",
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
          };

          if (r === 0 && cell.colIndex === 0 && lineIndex === 0) {
            line.tableMeta = {
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
        sliceGroup: "table",
        sliceFromPrev: false,
        sliceHasNext: false,
        sliceRowSplit: false,
        tableSliceFromPrev: false,
        tableSliceHasNext: false,
      },
    };
  },

  splitBlock: splitTableBlock,

  /* 染谋愿默染 */

  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }) {
    if (line?.blockAttrs?.listType) {
      renderListMarker({ ctx, line, pageX, pageTop, layout });
    }
    if (line.tableMeta) {
      const tableXOffset = Number.isFinite(line.tableMeta?.tableXOffset)
        ? line.tableMeta.tableXOffset
        : 0;
      const tableX = pageX + layout.margin.left + tableXOffset;
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
        rowSplit,
        sliceBreak,
        cells,
      } = line.tableMeta;

      const suppressTop = !!rowSplit && !!continuedFromPrev;
      const suppressBottom = !!rowSplit && !!continuesAfter;
      const forceTop = !rowSplit && !!sliceBreak && !!continuedFromPrev;
      const forceBottom = !rowSplit && !!sliceBreak && !!continuesAfter;
      const showTop = !suppressTop && (!continuedFromPrev || forceTop);
      const showBottom = !suppressBottom && (!continuesAfter || forceBottom);

      ctx.save();
      // Fill custom cell backgrounds first; header cells keep a neutral fallback color.
      if (Array.isArray(cells) && cells.length > 0) {
        for (const cell of cells) {
          const explicitBackground = normalizeTableCellBackground(cell?.background);
          const fillColor = explicitBackground || (cell?.header === true ? "#f3f4f6" : null);
          if (!fillColor) {
            continue;
          }
          const x = tableX + (Number.isFinite(cell.x) ? cell.x : 0);
          const y = tableY + (Number.isFinite(cell.y) ? cell.y : 0);
          const width = Number.isFinite(cell.width) ? cell.width : 0;
          const height = Number.isFinite(cell.height) ? cell.height : 0;
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
          const x1 = tableX + (Number.isFinite(cell.x) ? cell.x : 0);
          const y1 = tableY + (Number.isFinite(cell.y) ? cell.y : 0);
          const x2 = x1 + (Number.isFinite(cell.width) ? cell.width : 0);
          const y2 = y1 + (Number.isFinite(cell.height) ? cell.height : 0);
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
      } else {
        ctx.beginPath();
        // outer borders
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
      }

      ctx.restore();
    }

    defaultRender(line, pageX, pageTop, layout);
  },
};
