import { buildSplitResultWithFragments } from "./splitResult";

const getTableSliceMeta = (line) => line?.tableOwnerMeta || line?.tableMeta || null;

const sumHeights = (rows, count?: number) => {
  const limit = Math.min(count ?? rows.length, rows.length);
  let total = 0;
  for (let i = 0; i < limit; i += 1) {
    total += rows[i];
  }
  return total;
};

export const splitTableBlock = ({ lines, length, availableHeight, blockAttrs, settings }) => {
  if (!lines || lines.length === 0) {
    return null;
  }

  const firstAttrs = lines[0].blockAttrs || {};

  // Recover full row heights for slicing.
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
  if (fullRowHeights.length === 0 && Array.isArray(getTableSliceMeta(lines[0])?.rowHeights)) {
    fullRowHeights = getTableSliceMeta(lines[0]).rowHeights;
  }

  if (fullRowHeights.length === 0) {
    return null;
  }

  const cols = Number.isFinite(firstAttrs.cols) ? firstAttrs.cols : 0;
  const colWidth = Number.isFinite(firstAttrs.colWidth) ? firstAttrs.colWidth : 0;
  const tableWidth = Number.isFinite(firstAttrs.tableWidth) ? firstAttrs.tableWidth : 0;
  const padding = Number.isFinite(firstAttrs.padding) ? firstAttrs.padding : 0;
  const paddingY = Number.isFinite(firstAttrs.paddingY) ? firstAttrs.paddingY : (blockAttrs?.paddingY ?? 0);

  // Row offset of current slice within original table.
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

  const sourceMetaLine = lines.find((line) => Array.isArray(getTableSliceMeta(line)?.cells));
  const sourceCells = Array.isArray(getTableSliceMeta(sourceMetaLine)?.cells)
    ? getTableSliceMeta(sourceMetaLine).cells
    : [];

  // Remap source lines into current slice coordinate space.
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
      const { tableOwnerMeta: _tableOwnerMeta, ...lineCopy } = line;
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
      attrs.sliceGroup = "table";
      attrs.sliceFromPrev = !!sliceFromPrev;
      attrs.sliceHasNext = !!sliceHasNext;
      attrs.sliceRowSplit = !!rowSplitFlag;
      attrs.tableSliceFromPrev = !!sliceFromPrev;
      attrs.tableSliceHasNext = !!sliceHasNext;
      attrs.tableRowSplit = !!rowSplitFlag;

      lineCopy.blockAttrs = attrs;

      if (typeof lineCopy.relativeY === "number") {
        lineCopy.relativeY = lineCopy.relativeY - relativeYOffset;
      }

      return lineCopy;
    });

  const buildSliceCells = (sliceTop, rowHeights) => {
    if (!Array.isArray(sourceCells) || sourceCells.length === 0) {
      return [];
    }
    const sliceHeight = rowHeights.reduce((sum, h) => sum + h, 0);
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

  const applyTableMeta = (
    sliceLines,
    rowHeights,
    sliceFromPrev,
    sliceHasNext,
    rowSplit = false,
    sliceBreak = false,
    sliceTop = 0
  ) => {
    if (sliceLines.length === 0) {
      return;
    }

    const tableHeight = rowHeights.reduce((sum, h) => sum + h, 0);
    const tableOwnerMeta = {
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
      continuedFromPrev: !!sliceFromPrev,
      continuesAfter: !!sliceHasNext,
      rowSplit: !!rowSplit,
      sliceBreak: !!sliceBreak,
    };
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
            meta:
              owner?.meta && typeof owner.meta === "object"
                ? { ...owner.meta }
                : owner?.meta ?? null,
          };
          if (!updatedRootOwner && nextOwner.role === "table") {
            nextOwner.meta = {
              ...(nextOwner.meta || {}),
              ...tableOwnerMeta,
            };
            updatedRootOwner = true;
          }
          return nextOwner;
        });
      }
    }
  };

  // Compute visible rows in current page height.
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

  // Carry continuation flags from previous slice.
  const inheritedSliceFromPrev = lines.some(
    (line) =>
      line?.blockAttrs?.sliceFromPrev ||
      line?.blockAttrs?.tableSliceFromPrev ||
      getTableSliceMeta(line)?.continuedFromPrev
  );
  const inheritedRowSplit = lines.some(
    (line) =>
      line?.blockAttrs?.sliceRowSplit ||
      line?.blockAttrs?.tableRowSplit ||
      getTableSliceMeta(line)?.rowSplit
  );

  if (visibleRowCount === 0) {
    const firstRowHeight = baseRowHeights[0] ?? 0;
    const fullAvailableHeight = settings
      ? Math.max(0, settings.pageHeight - settings.margin.top - settings.margin.bottom)
      : availableHeight;

    const canFitOnFreshPage =
      fullAvailableHeight > 0 && firstRowHeight > 0 && firstRowHeight <= fullAvailableHeight;
    if (canFitOnFreshPage) {
      const fullHeight = sumHeights(baseRowHeights);
      return buildSplitResultWithFragments({
        lines: [],
        length: 0,
        height: 0,
        overflow: {
          lines,
          length,
          height: fullHeight,
        },
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

      for (const line of lines) {
        const rowIndex = Number.isFinite(line.blockAttrs?.rowIndex) ? line.blockAttrs.rowIndex : 0;
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
      const overflowRowHeights = [Math.max(0, firstRowHeight - cutHeight), ...baseRowHeights.slice(1)];
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

      applyTableMeta(
        visibleLines,
        visibleRowHeights,
        resolvedRowOffset > 0 || inheritedSliceFromPrev,
        true,
        true,
        false,
        baseOffsetY
      );
      applyTableMeta(overflowLines, overflowRowHeights, true, needsAnotherSlice, true, false, cutY);

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

      return buildSplitResultWithFragments({
        lines: visibleLines,
        length: visibleLengthInner,
        height: visibleHeight,
        overflow: {
          lines: overflowLines,
          length: Math.max(0, length - visibleLengthInner),
          height: overflowHeight,
        },
      });
    }

    const fullHeight = sumHeights(baseRowHeights);
    return buildSplitResultWithFragments({
      lines: [],
      length: 0,
      height: 0,
      overflow: {
        lines,
        length,
        height: fullHeight,
      },
    });
  }

  // Regular row-based pagination.
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
    hasOverflow,
    baseOffsetY
  );
  applyTableMeta(
    overflowLines,
    overflowRowHeights,
    true,
    false,
    hasRowSplit,
    hasOverflow,
    overflowOffsetY
  );

  if (!hasOverflow) {
    for (const line of visibleLines) {
      if (line?.blockAttrs) {
        line.blockAttrs.sliceHasNext = false;
        line.blockAttrs.tableSliceHasNext = false;
      }
    }
    if (visibleLines[0]?.tableOwnerMeta) {
      visibleLines[0].tableOwnerMeta.continuesAfter = false;
    }
  }

  const visibleHeight = sumHeights(visibleRowHeights);
  const overflowHeight = sumHeights(overflowRowHeights);

  return buildSplitResultWithFragments({
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
  });
};
