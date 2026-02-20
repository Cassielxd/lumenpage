/*
 * 文件说明：表格节点渲染配置。
 * 主要职责：计算单元格布局、行高与单元格文本 runs。
 */

import { type NodeSpec } from "lumenpage-model";
import { docToRuns, textblockToRuns, breakLines } from "lumenpage-view-canvas";

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

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
    content: "block+",

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

const sumHeights = (rows, count?: number) => {
  const limit = Math.min(count ?? rows.length, rows.length);
  let total = 0;
  for (let i = 0; i < limit; i += 1) {
    total += rows[i];
  }
  return total;
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
        ? textblockToRuns(
            node,
            blockSettings,
            node.type.name,
            blockId,
            node.attrs,
            0
          )
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
    result = { lines, length, height: lines.length * (blockLineHeight || settings.lineHeight) };
  }

  const lines = result?.lines?.length
    ? result.lines
    : [{ text: "", start: 0, end: 0, width: 0, runs: [] }];
  const length = result?.length ?? 0;
  const lineHeightValue =
    Number.isFinite(blockAttrs?.lineHeight) ? blockAttrs.lineHeight : settings.lineHeight;

  let height = Number.isFinite(result?.height)
    ? result.height
    : lines.length * lineHeightValue;

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
  const isLeaf =
    renderer?.layoutBlock || renderer?.toRuns || node.isTextblock || node.isAtom;

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
    margin: { ...settings.margin, left: 0, right: 0 },
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

  /* 񲼾֣㵥Ԫıиߣɱб */

  layoutBlock({ node, settings, registry }) {
    const { rows, cols } = getTableShape(node);

    const tableWidth = settings.pageWidth - settings.margin.left - settings.margin.right;

    const colWidth = tableWidth / cols;

    const padding = 8;

    const paddingY = 10;

    const minRowHeight = Math.max(settings.lineHeight * 1.6, settings.lineHeight + paddingY * 2);

    const maxCellWidth = Math.max(0, colWidth - padding * 2);

    // 每行最终高度、行内最大行数、内容实际高度：用于分页与行内拆分判断
    const rowHeights = [];
    const rowMaxLines = [];
    const rowContentHeights = [];

    // 暂存每个 cell 的布局结果（行内拆分会用到）
    const cellLayouts = [];

    let tableOffset = 0;

    for (let r = 0; r < rows; r += 1) {
      const row = node.child(r);

      const rowCells = [];

      let maxContentHeight = 0;

      for (let c = 0; c < cols; c += 1) {
        const cell = c < row.childCount ? row.child(c) : null;

        const cellBaseX = settings.margin.left + c * colWidth + padding;
        const cellLayout = layoutCell(cell, settings, registry, maxCellWidth, cellBaseX);

        const cellLength = cellLayout.length || 0;

        // 行高度由本行内最高的 cell 内容决定
        maxContentHeight = Math.max(maxContentHeight, cellLayout.height || 0);

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

      // 记录行内容高度（不含上下 padding）
      rowContentHeights[r] = maxContentHeight;

      const rowContentHeight = maxContentHeight + paddingY * 2;
      rowHeights[r] = Math.max(rowContentHeight, minRowHeight);
      rowMaxLines[r] = Math.max(1, Math.ceil(maxContentHeight / settings.lineHeight));

      cellLayouts.push(rowCells);

      if (r < rows - 1) {
        tableOffset += 1;
      }
    }

    // 生成可绘制的“行文本/元素”列表（带上 cell 对应位置）
    const lines = [];

    let tableTop = 0;

    const tableHeight = rowHeights.reduce((sum, h) => sum + h, 0);

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

      // 当单行超过整页高度时，顶端对齐（避免居中导致切分位置不稳定）
      const shouldTopAlign =
        fullAvailableHeight > 0 && rowHeights[r] > fullAvailableHeight;

      const rowInset = shouldTopAlign ? paddingY : paddingY + rowExtra / 2;

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

          const cellBaseX = settings.margin.left + cell.colIndex * colWidth + padding;
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

  splitBlock({ lines, length, availableHeight, blockAttrs, settings }) {
    if (!lines || lines.length === 0) {
      return null;
    }

    const firstAttrs = lines[0].blockAttrs || {};

    // 从 blockAttrs / tableMeta 中恢复完整行高（用于切片）
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

    // 当前切片在原表格里的行偏移
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

    // 将原行索引、相对 Y 偏移等映射到“当前切片”的坐标系
    const remapLines = (
      sourceLines,
      rowIndexOffset,
      rowHeights,
      relativeYOffset,
      sliceFromPrev,
      sliceHasNext,
      rowSplitFlag = false
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
        // 供分页逻辑与渲染阶段识别当前是否为跨页切片
        attrs.tableSliceFromPrev = !!sliceFromPrev;
        attrs.tableSliceHasNext = !!sliceHasNext;
        // 供后续分页继续识别“行内拆分”
        attrs.tableRowSplit = !!rowSplitFlag;

        lineCopy.blockAttrs = attrs;

        if (typeof lineCopy.relativeY === "number") {
          lineCopy.relativeY = lineCopy.relativeY - relativeYOffset;
        }

        return lineCopy;
      });

    // 为当前切片首行写入 tableMeta（用于渲染边框、调试面板）
    const applyTableMeta = (
      sliceLines,
      rowHeights,
      sliceFromPrev,
      sliceHasNext,
      rowSplit = false,
      sliceBreak = false
    ) => {
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
        rowSplit: !!rowSplit,
        sliceBreak: !!sliceBreak,
      };
    };

    // 计算本页能完整容纳的行数
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

    // 继承上一页切片状态，确保后续分页不中断
    const inheritedSliceFromPrev = lines.some(
      (line) => line?.blockAttrs?.tableSliceFromPrev || line?.tableMeta?.continuedFromPrev
    );
    const inheritedRowSplit = lines.some(
      (line) => line?.blockAttrs?.tableRowSplit || line?.tableMeta?.rowSplit
    );

    if (visibleRowCount === 0) {
      const firstRowHeight = baseRowHeights[0] ?? 0;
      const fullAvailableHeight = settings
        ? Math.max(0, settings.pageHeight - settings.margin.top - settings.margin.bottom)
        : availableHeight;
      // 若整行能放入“新页”，但当前页放不下，则把整表切到下一页
      const canFitOnFreshPage =
        fullAvailableHeight > 0 && firstRowHeight > 0 && firstRowHeight <= fullAvailableHeight;
      if (canFitOnFreshPage) {
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
      // 处理“单行超页高”的行内拆分：只在接近页底时触发
      const spacingAllowance = Math.max(0, settings?.blockSpacing || 0);
      const effectiveAvailableHeight = Math.max(0, availableHeight - paddingY);
      const effectiveFullHeight = Math.max(0, fullAvailableHeight - paddingY);
      if (
        firstRowHeight > 0 &&
        fullAvailableHeight > 0 &&
        firstRowHeight > fullAvailableHeight &&
        effectiveAvailableHeight >= effectiveFullHeight - spacingAllowance
      ) {
        // 在当前页可容纳高度处切分该行
        const cutHeight = Math.max(1, Math.min(effectiveAvailableHeight, firstRowHeight));
        const cutY = baseOffsetY + cutHeight;
        const visibleLinesRaw = [];
        const overflowLinesRaw = [];

        for (const line of lines) {
          const rowIndex = Number.isFinite(line.blockAttrs?.rowIndex)
            ? line.blockAttrs.rowIndex
            : 0;
          if (rowIndex < resolvedRowOffset) {
            continue;
          }
          if (rowIndex === resolvedRowOffset) {
            const relY = Number.isFinite(line.relativeY) ? line.relativeY : 0;
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
        const overflowRowHeights = [
          Math.max(0, firstRowHeight - cutHeight),
          ...baseRowHeights.slice(1),
        ];

        const overflowTotalHeight = sumHeights(overflowRowHeights);
        const needsAnotherSlice = overflowTotalHeight > effectiveFullHeight;

        const visibleLines = remapLines(
          visibleLinesRaw,
          resolvedRowOffset,
          visibleRowHeights,
          baseOffsetY,
          resolvedRowOffset > 0 || inheritedSliceFromPrev,
          true,
          true
        );

        const overflowLines = remapLines(
          overflowLinesRaw,
          resolvedRowOffset,
          overflowRowHeights,
          cutY,
          true,
          needsAnotherSlice,
          true
        );

        // 标记当前页为“行内拆分”的起始切片
        applyTableMeta(
          visibleLines,
          visibleRowHeights,
          resolvedRowOffset > 0 || inheritedSliceFromPrev,
          true,
          true,
          false
        );
        // 标记溢出切片是否还需要继续分页
        applyTableMeta(
          overflowLines,
          overflowRowHeights,
          true,
          needsAnotherSlice,
          true,
          false
        );

        const visibleStart = visibleLinesRaw.reduce((min, line) => {
          const start = Number.isFinite(line.start) ? line.start : 0;
          return Math.min(min, start);
        }, Number.POSITIVE_INFINITY);
        const visibleEnd = visibleLinesRaw.reduce((max, line) => {
          const end = Number.isFinite(line.end) ? line.end : 0;
          return Math.max(max, end);
        }, 0);
        const normalizedStart = Number.isFinite(visibleStart) ? visibleStart : 0;
        const visibleLengthInner = Math.max(0, visibleEnd - normalizedStart);

        const visibleHeight = sumHeights(visibleRowHeights);
        const overflowHeight = sumHeights(overflowRowHeights);

        return {
          lines: visibleLines,
          length: visibleLengthInner,
          height: visibleHeight,
          overflow: {
            lines: overflowLines,
            length: Math.max(0, length - visibleLengthInner),
            height: overflowHeight,
          },
        };
      }

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

    // 常规按“整行”分页
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

    const visibleLines = remapLines(
      visibleLinesRaw,

      resolvedRowOffset,

      visibleRowHeights,

      baseOffsetY,
      resolvedRowOffset > 0 || inheritedSliceFromPrev,
      overflowRowHeights.length > 0,
      inheritedRowSplit
    );

    const overflowLines = remapLines(
      overflowLinesRaw,

      resolvedRowOffset + visibleRowCount,

      overflowRowHeights,

      overflowOffsetY,
      true,
      false,
      inheritedRowSplit
    );

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
    const hasRowSplit = inheritedRowSplit;
    const hasOverflow = overflowLines.length > 0;
      applyTableMeta(
        visibleLines,
        visibleRowHeights,
        resolvedRowOffset > 0,
        hasOverflow,
        hasRowSplit,
        hasOverflow
      );

      applyTableMeta(
        overflowLines,
        overflowRowHeights,
        true,
        false,
        hasRowSplit,
        hasOverflow
      );

    // 最后一页需要清理“还有后续”的标记
    if (!hasOverflow) {
      for (const line of visibleLines) {
        if (line?.blockAttrs) {
          line.blockAttrs.tableSliceHasNext = false;
        }
      }
      if (visibleLines[0]?.tableMeta) {
        visibleLines[0].tableMeta.continuesAfter = false;
      }
    }

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
        const suppressTop = !!rowSplit && !!continuedFromPrev;
        const suppressBottom = !!rowSplit && !!continuesAfter;
        const forceTop = !rowSplit && !!sliceBreak && !!continuedFromPrev;
        const forceBottom = !rowSplit && !!sliceBreak && !!continuesAfter;

        if (!suppressTop && (!continuedFromPrev || forceTop)) {
          ctx.moveTo(tableX, tableY);
          ctx.lineTo(tableX + tableWidth, tableY);
        }
        if (!suppressBottom && (!continuesAfter || forceBottom)) {
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



