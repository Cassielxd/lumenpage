import { CellSelection } from "./cellSelection";

const getTableMaxCols = (table) => {
  let cols = 0;
  table.forEach((row) => {
    cols = Math.max(cols, row.childCount);
  });
  return Math.max(cols, 1);
};

const createEmptyCell = (schema) => {
  const cellType = schema.nodes.table_cell;
  const paragraphType = schema.nodes.paragraph;

  let cell = cellType.createAndFill();
  if (cell) {
    return cell;
  }

  const paragraph = paragraphType?.createAndFill?.() ?? paragraphType?.create?.() ?? null;
  if (paragraph) {
    cell = cellType.createAndFill(null, [paragraph]) ?? cellType.create(null, [paragraph]);
    if (cell) {
      return cell;
    }
  }

  throw new Error("Cannot create table_cell with the current schema.");
};

const createCellWithAttrs = (cell, attrs, content = undefined) =>
  cell.type.create({ ...(cell.attrs || {}), ...(attrs || {}) }, content ?? cell.content, cell.marks);

const getSpan = (cell, key) => {
  const value = cell?.attrs?.[key];
  return Number.isFinite(value) && value > 0 ? value : 1;
};

const getLogicalColStart = (row, colIndex) => {
  let logical = 0;
  for (let i = 0; i < colIndex; i += 1) {
    logical += getSpan(row.child(i), "colspan");
  }
  return logical;
};

const findInsertIndexForLogicalCol = (row, logicalCol) => {
  let logical = 0;
  for (let i = 0; i < row.childCount; i += 1) {
    if (logical >= logicalCol) {
      return i;
    }
    logical += getSpan(row.child(i), "colspan");
  }
  return row.childCount;
};

const buildTableGrid = (table, tablePos) => {
  const matrix = [];
  const anchors = [];
  const byPos = new Map();

  const ensureRow = (rowIndex) => {
    if (!matrix[rowIndex]) {
      matrix[rowIndex] = [];
    }
    return matrix[rowIndex];
  };

  for (let rowIndex = 0; rowIndex < table.childCount; rowIndex += 1) {
    const row = table.child(rowIndex);
    const gridRow = ensureRow(rowIndex);
    let logicalCol = 0;
    for (let colIndex = 0; colIndex < row.childCount; colIndex += 1) {
      while (gridRow[logicalCol]) {
        logicalCol += 1;
      }
      const cell = row.child(colIndex);
      const rowspan = getSpan(cell, "rowspan");
      const colspan = getSpan(cell, "colspan");
      const pos = resolveCellPos(table, tablePos, rowIndex, colIndex);
      const entry = { pos, row: rowIndex, col: logicalCol, rowspan, colspan, rowIndex, colIndex };
      anchors.push(entry);
      byPos.set(pos, entry);

      for (let dr = 0; dr < rowspan; dr += 1) {
        const rr = rowIndex + dr;
        const rrRow = ensureRow(rr);
        for (let dc = 0; dc < colspan; dc += 1) {
          rrRow[logicalCol + dc] = entry;
        }
      }
      logicalCol += colspan;
    }
  }

  anchors.sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));
  const cols = matrix.reduce((max, row) => Math.max(max, row?.length || 0), 0);
  return { matrix, anchors, byPos, cols };
};

const findAnchorCoveringCol = (grid, row, col) => {
  const rowItems = grid.matrix[row];
  if (!rowItems || col < 0 || col >= rowItems.length) {
    return null;
  }
  const entry = rowItems[col];
  if (!entry) {
    return null;
  }
  return entry;
};

const findCellLocationByPos = (grid, targetPos) => {
  const entry = grid.byPos.get(targetPos);
  if (!entry) {
    return null;
  }
  return { rowIndex: entry.row, colIndex: entry.col };
};

const getSelectionRect = (state, context) => {
  if (!(state.selection instanceof CellSelection)) {
    return null;
  }
  const anchor = findCellLocationByPos(context.grid, state.selection.anchor);
  const head = findCellLocationByPos(context.grid, state.selection.head);
  if (!anchor || !head) {
    return null;
  }
  return {
    top: Math.min(anchor.rowIndex, head.rowIndex),
    bottom: Math.max(anchor.rowIndex, head.rowIndex),
    left: Math.min(anchor.colIndex, head.colIndex),
    right: Math.max(anchor.colIndex, head.colIndex),
  };
};

const createRow = (schema, colCount) => {
  const rowType = schema.nodes.table_row;
  const cells = [];
  for (let i = 0; i < colCount; i += 1) {
    cells.push(createEmptyCell(schema));
  }
  return rowType.create(null, cells);
};

const findTableContext = (state) => {
  const $from = state.selection?.$from;
  if (!$from) {
    return null;
  }

  let tableDepth = -1;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth)?.type?.name === "table") {
      tableDepth = depth;
      break;
    }
  }

  if (tableDepth < 0) {
    return null;
  }

  const table = $from.node(tableDepth);
  const tablePos = $from.start(tableDepth) - 1;

  let rowIndex = 0;
  if (tableDepth + 1 <= $from.depth && $from.node(tableDepth + 1)?.type?.name === "table_row") {
    rowIndex = $from.index(tableDepth);
  }

  let colIndex = 0;
  if (tableDepth + 2 <= $from.depth && $from.node(tableDepth + 2)?.type?.name === "table_cell") {
    colIndex = $from.index(tableDepth + 1);
  }

  const grid = buildTableGrid(table, tablePos);
  const currentPos = resolveCellPos(table, tablePos, rowIndex, colIndex);
  const currentAnchor = grid.byPos.get(currentPos) ?? null;

  return { table, tablePos, rowIndex, colIndex, grid, currentAnchor };
};

const replaceTable = (state, dispatch, tablePos, table, nextTable) => {
  if (!dispatch) {
    return true;
  }
  const tr = state.tr
    .replaceWith(tablePos, tablePos + table.nodeSize, nextTable)
    .scrollIntoView();
  dispatch(tr);
  return true;
};

const updateRows = (state, dispatch, mutateRows) => {
  const context = findTableContext(state);
  if (!context) {
    return false;
  }

  const schema = state.schema;
  const rows = [];
  context.table.forEach((row) => rows.push(row));
  const cols = context.grid?.cols ?? getTableMaxCols(context.table);
  const nextRows = mutateRows(rows, cols, context);
  if (!nextRows) {
    return false;
  }

  const tableType = schema.nodes.table;
  const nextTable = tableType.create(context.table.attrs, nextRows, context.table.marks);
  return replaceTable(state, dispatch, context.tablePos, context.table, nextTable);
};

const resolveCellPos = (table, tablePos, rowIndex, colIndex) => {
  const safeRow = Math.max(0, Math.min(table.childCount - 1, rowIndex));
  let pos = tablePos + 1;
  for (let r = 0; r < safeRow; r += 1) {
    pos += table.child(r).nodeSize;
  }
  const row = table.child(safeRow);
  const safeCol = Math.max(0, Math.min(row.childCount - 1, colIndex));
  pos += 1;
  for (let c = 0; c < safeCol; c += 1) {
    pos += row.child(c).nodeSize;
  }
  return pos;
};

const moveToCellByPos = (state, dispatch, cellPos) => {
  if (!Number.isFinite(cellPos)) {
    return false;
  }
  if (!dispatch) {
    return true;
  }
  const $cell = state.doc.resolve(cellPos);
  const selectionCtor = state.selection?.constructor;
  const selection =
    typeof selectionCtor?.near === "function" ? selectionCtor.near($cell, 1) : null;
  if (!selection) {
    return false;
  }
  dispatch(state.tr.setSelection(selection).scrollIntoView());
  return true;
};

const moveToCell = (state, dispatch, rowIndex, colIndex) => {
  const context = findTableContext(state);
  if (!context || context.table.childCount === 0) {
    return false;
  }
  const targetPos = resolveCellPos(context.table, context.tablePos, rowIndex, colIndex);
  return moveToCellByPos(state, dispatch, targetPos);
};

export const addTableRowAfter = (state, dispatch) =>
  updateRows(state, dispatch, (rows, cols, context) => {
    const insertAt = Math.min(rows.length, Math.max(0, context.rowIndex + 1));
    const next = rows.slice();
    next.splice(insertAt, 0, createRow(state.schema, cols));
    return next;
  });

export const addTableRowBefore = (state, dispatch) =>
  updateRows(state, dispatch, (rows, cols, context) => {
    const insertAt = Math.min(rows.length, Math.max(0, context.rowIndex));
    const next = rows.slice();
    next.splice(insertAt, 0, createRow(state.schema, cols));
    return next;
  });

export const deleteTableRow = (state, dispatch) =>
  updateRows(state, dispatch, (rows, _cols, context) => {
    if (rows.length <= 1) {
      return null;
    }
    const removeAt = Math.min(rows.length - 1, Math.max(0, context.rowIndex));
    const next = rows.slice();
    next.splice(removeAt, 1);
    return next;
  });

export const addTableColumnAfter = (state, dispatch) =>
  updateRows(state, dispatch, (rows, cols, context) => {
    const anchor = context.currentAnchor;
    if (!anchor) {
      return null;
    }
    const logicalTarget = anchor.col + anchor.colspan;
    return rows.map((row) => {
      const cells = [];
      for (let c = 0; c < row.childCount; c += 1) {
        cells.push(row.child(c));
      }
      const insertAt = findInsertIndexForLogicalCol(row, logicalTarget);
      cells.splice(insertAt, 0, createEmptyCell(state.schema));
      return state.schema.nodes.table_row.create(row.attrs, cells, row.marks);
    });
  });

export const addTableColumnBefore = (state, dispatch) =>
  updateRows(state, dispatch, (rows, cols, context) => {
    const anchor = context.currentAnchor;
    if (!anchor) {
      return null;
    }
    const logicalTarget = anchor.col;
    return rows.map((row) => {
      const cells = [];
      for (let c = 0; c < row.childCount; c += 1) {
        cells.push(row.child(c));
      }
      const insertAt = findInsertIndexForLogicalCol(row, logicalTarget);
      cells.splice(insertAt, 0, createEmptyCell(state.schema));
      return state.schema.nodes.table_row.create(row.attrs, cells, row.marks);
    });
  });

export const deleteTableColumn = (state, dispatch) =>
  updateRows(state, dispatch, (rows, cols, context) => {
    const anchor = context.currentAnchor;
    const grid = context.grid;
    if (!anchor || !grid || grid.cols <= 1) {
      return null;
    }
    const logicalTarget = Math.max(0, Math.min(grid.cols - 1, anchor.col));
    const processed = new Set<number>();
    const nextRows = rows.slice();

    for (let r = 0; r < grid.matrix.length; r += 1) {
      const entry = findAnchorCoveringCol(grid, r, logicalTarget);
      if (!entry || processed.has(entry.pos)) {
        continue;
      }
      processed.add(entry.pos);
      const rowNode = nextRows[entry.row];
      if (!rowNode) {
        continue;
      }
      const colIndex = Math.max(0, Math.min(rowNode.childCount - 1, entry.colIndex));
      const cell = rowNode.child(colIndex);
      const colspan = getSpan(cell, "colspan");
      const cells = [];
      for (let c = 0; c < rowNode.childCount; c += 1) {
        if (c !== colIndex) {
          cells.push(rowNode.child(c));
          continue;
        }
        if (colspan > 1) {
          cells.push(createCellWithAttrs(cell, { colspan: colspan - 1 }));
        }
      }
      nextRows[entry.row] = state.schema.nodes.table_row.create(rowNode.attrs, cells, rowNode.marks);
    }

    return nextRows;
  });

export const goToNextTableCell = (state, dispatch) => {
  const context = findTableContext(state);
  if (!context) {
    return false;
  }
  const currentPos = context.currentAnchor?.pos;
  if (!Number.isFinite(currentPos)) {
    return false;
  }
  const grid = buildTableGrid(context.table, context.tablePos);
  const current = grid.byPos.get(currentPos);
  if (!current) {
    return false;
  }
  const index = grid.anchors.findIndex((item) => item.pos === current.pos);
  if (index < 0 || index + 1 >= grid.anchors.length) {
    return false;
  }
  return moveToCellByPos(state, dispatch, grid.anchors[index + 1].pos);
};

export const goToPreviousTableCell = (state, dispatch) => {
  const context = findTableContext(state);
  if (!context) {
    return false;
  }
  const currentPos = context.currentAnchor?.pos;
  if (!Number.isFinite(currentPos)) {
    return false;
  }
  const grid = buildTableGrid(context.table, context.tablePos);
  const current = grid.byPos.get(currentPos);
  if (!current) {
    return false;
  }
  const index = grid.anchors.findIndex((item) => item.pos === current.pos);
  if (index <= 0) {
    return false;
  }
  return moveToCellByPos(state, dispatch, grid.anchors[index - 1].pos);
};

export const mergeTableCellRight = (state, dispatch) =>
  updateRows(state, dispatch, (rows, cols, context) => {
    const anchor = context.currentAnchor;
    if (!anchor) {
      return null;
    }
    const row = rows[anchor.rowIndex];
    if (!row) {
      return null;
    }
    const currentIndex = Math.min(Math.max(0, anchor.colIndex), row.childCount - 1);
    const rightIndex = currentIndex + 1;
    if (rightIndex >= row.childCount) {
      return null;
    }

    const leftCell = row.child(currentIndex);
    const rightCell = row.child(rightIndex);
    if (!leftCell || !rightCell) {
      return null;
    }

    if (getSpan(leftCell, "rowspan") !== getSpan(rightCell, "rowspan")) {
      return null;
    }

    const merged = createCellWithAttrs(
      leftCell,
      { colspan: getSpan(leftCell, "colspan") + getSpan(rightCell, "colspan") },
      leftCell.content.append(rightCell.content)
    );

    const cells = [];
    for (let c = 0; c < cols; c += 1) {
      if (c === currentIndex) {
        cells.push(merged);
        continue;
      }
      if (c === rightIndex) {
        continue;
      }
      cells.push(row.child(c));
    }

    const nextRows = rows.slice();
    nextRows[anchor.rowIndex] = state.schema.nodes.table_row.create(row.attrs, cells, row.marks);
    return nextRows;
  });

export const splitTableCell = (state, dispatch) =>
  updateRows(state, dispatch, (rows, cols, context) => {
    const rect = getSelectionRect(state, context);
    let targetRowIndex = rect ? rect.top : context.rowIndex;
    let targetColIndex = rect ? rect.left : context.colIndex;
    let row = rows[targetRowIndex];
    if (!row) {
      return null;
    }
    let currentIndex = Math.min(Math.max(0, targetColIndex), row.childCount - 1);
    let cell = row.child(currentIndex);
    if (!cell) {
      return null;
    }

    let colspan = getSpan(cell, "colspan");
    let rowspan = getSpan(cell, "rowspan");

    if (colspan <= 1 && rowspan <= 1) {
      let found = null;
      for (let r = 0; r < rows.length; r += 1) {
        const scanRow = rows[r];
        for (let c = 0; c < scanRow.childCount; c += 1) {
          const scanCell = scanRow.child(c);
          if (getSpan(scanCell, "colspan") > 1 || getSpan(scanCell, "rowspan") > 1) {
            found = { r, c, cell: scanCell };
            break;
          }
        }
        if (found) {
          break;
        }
      }
      if (!found) {
        return null;
      }
      targetRowIndex = found.r;
      targetColIndex = found.c;
      row = rows[targetRowIndex];
      currentIndex = Math.min(Math.max(0, targetColIndex), row.childCount - 1);
      cell = found.cell;
      colspan = getSpan(cell, "colspan");
      rowspan = getSpan(cell, "rowspan");
    }

    if (colspan > 1) {
      const cells = [];
      for (let c = 0; c < row.childCount; c += 1) {
        if (c !== currentIndex) {
          cells.push(row.child(c));
          continue;
        }
        const left = createCellWithAttrs(cell, { colspan: Math.max(1, colspan - 1) });
        const inserted = createCellWithAttrs(createEmptyCell(state.schema), { rowspan });
        cells.push(left, inserted);
      }

      const nextRows = rows.slice();
      nextRows[targetRowIndex] = state.schema.nodes.table_row.create(row.attrs, cells, row.marks);
      return nextRows;
    }

    if (rowspan > 1) {
      const nextRows = rows.slice();
      const updatedCurrentRowCells = [];
      for (let c = 0; c < row.childCount; c += 1) {
        const rowCell = row.child(c);
        if (c === currentIndex) {
          updatedCurrentRowCells.push(
            createCellWithAttrs(rowCell, { rowspan: Math.max(1, rowspan - 1) })
          );
        } else {
          updatedCurrentRowCells.push(rowCell);
        }
      }
      nextRows[targetRowIndex] = state.schema.nodes.table_row.create(
        row.attrs,
        updatedCurrentRowCells,
        row.marks
      );

      const rowToInsertIndex = targetRowIndex + rowspan - 1;
      if (rowToInsertIndex >= rows.length) {
        return null;
      }
      const targetRow = rows[rowToInsertIndex];
      if (!targetRow) {
        return null;
      }
      const logicalCol = getLogicalColStart(row, currentIndex);
      const insertIndex = findInsertIndexForLogicalCol(targetRow, logicalCol);
      const targetCells = [];
      for (let c = 0; c < targetRow.childCount; c += 1) {
        if (c === insertIndex) {
          targetCells.push(createEmptyCell(state.schema));
        }
        targetCells.push(targetRow.child(c));
      }
      if (insertIndex >= targetRow.childCount) {
        targetCells.push(createEmptyCell(state.schema));
      }
      nextRows[rowToInsertIndex] = state.schema.nodes.table_row.create(
        targetRow.attrs,
        targetCells,
        targetRow.marks
      );

      return nextRows;
    }

    return null;
  });

export const mergeSelectedTableCells = (state, dispatch) => {
  const context = findTableContext(state);
  if (!context) {
    return false;
  }
  const rect = getSelectionRect(state, context);
  if (!rect) {
    return false;
  }
  const grid = context.grid;
  const width = rect.right - rect.left + 1;
  const height = rect.bottom - rect.top + 1;
  if (width <= 1 && height <= 1) {
    return false;
  }
  const rectEntries = new Map();
  for (let r = rect.top; r <= rect.bottom; r += 1) {
    for (let c = rect.left; c <= rect.right; c += 1) {
      const entry = findAnchorCoveringCol(grid, r, c);
      if (!entry) {
        return false;
      }
      rectEntries.set(entry.pos, entry);
    }
  }
  const anchors = Array.from(rectEntries.values()).sort((a, b) =>
    a.row === b.row ? a.col - b.col : a.row - b.row
  );
  if (anchors.length === 0) {
    return false;
  }
  for (const entry of anchors) {
    const fullyInside =
      entry.row >= rect.top &&
      entry.col >= rect.left &&
      entry.row + entry.rowspan - 1 <= rect.bottom &&
      entry.col + entry.colspan - 1 <= rect.right;
    if (!fullyInside) {
      return false;
    }
  }
  const topLeft = findAnchorCoveringCol(grid, rect.top, rect.left);
  if (!topLeft || topLeft.row !== rect.top || topLeft.col !== rect.left) {
    return false;
  }
  const topRow = context.table.child(topLeft.rowIndex);
  const topLeftCell = topRow?.child(topLeft.colIndex);
  if (!topLeftCell) {
    return false;
  }

  let mergedContent = topLeftCell.content;
  for (const entry of anchors) {
    if (entry.pos === topLeft.pos) {
      continue;
    }
    const row = context.table.child(entry.rowIndex);
    const cell = row?.child(entry.colIndex);
    if (!cell) {
      return false;
    }
    mergedContent = mergedContent.append(cell.content);
  }
  const mergedCell = createCellWithAttrs(topLeftCell, { colspan: width, rowspan: height }, mergedContent);

  const removeSet = new Set(anchors.map((entry) => entry.pos));
  const nextRows = [];
  for (let rowIndex = 0; rowIndex < context.table.childCount; rowIndex += 1) {
    const row = context.table.child(rowIndex);
    const cells = [];
    for (let colIndex = 0; colIndex < row.childCount; colIndex += 1) {
      const pos = resolveCellPos(context.table, context.tablePos, rowIndex, colIndex);
      if (!removeSet.has(pos)) {
        cells.push(row.child(colIndex));
        continue;
      }
      if (pos === topLeft.pos) {
        cells.push(mergedCell);
      }
    }
    nextRows.push(state.schema.nodes.table_row.create(row.attrs, cells, row.marks));
  }

  const tableType = state.schema.nodes.table;
  const nextTable = tableType.create(context.table.attrs, nextRows, context.table.marks);
  return replaceTable(state, dispatch, context.tablePos, context.table, nextTable);
};

export const selectCurrentAndNextTableCell = (state, dispatch) => {
  const context = findTableContext(state);
  if (!context) {
    return false;
  }
  const grid = buildTableGrid(context.table, context.tablePos);
  const anchorPos = context.currentAnchor?.pos;
  if (!Number.isFinite(anchorPos)) {
    return false;
  }
  const anchor = grid.byPos.get(anchorPos);
  if (!anchor) {
    return false;
  }
  const targetCol = anchor.col + anchor.colspan;
  let head = findAnchorCoveringCol(grid, anchor.row, targetCol);
  if (!head) {
    const nextRowAnchors = grid.anchors.find((item) => item.row > anchor.row);
    head = nextRowAnchors ?? null;
  }
  if (!head) {
    return false;
  }
  const headPos = head.pos;
  if (!dispatch) {
    return true;
  }
  let selection = null;
  try {
    selection = CellSelection.create(state.doc, anchorPos, headPos);
  } catch (_error) {
    return false;
  }
  dispatch(state.tr.setSelection(selection).scrollIntoView());
  return true;
};

export const selectCurrentAndBelowTableCell = (state, dispatch) => {
  const context = findTableContext(state);
  if (!context) {
    return false;
  }
  const grid = buildTableGrid(context.table, context.tablePos);
  const anchorPos = context.currentAnchor?.pos;
  if (!Number.isFinite(anchorPos)) {
    return false;
  }
  const anchor = grid.byPos.get(anchorPos);
  if (!anchor) {
    return false;
  }
  const nextRowIndex = anchor.row + anchor.rowspan;
  if (nextRowIndex >= grid.matrix.length) {
    return false;
  }
  const head = findAnchorCoveringCol(grid, nextRowIndex, anchor.col);
  if (!head) {
    return false;
  }
  const headPos = head.pos;
  if (!dispatch) {
    return true;
  }
  let selection = null;
  try {
    selection = CellSelection.create(state.doc, anchorPos, headPos);
  } catch (_error) {
    return false;
  }
  dispatch(state.tr.setSelection(selection).scrollIntoView());
  return true;
};
