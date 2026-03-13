import type { PlaygroundLocale } from "../i18n";
import type { RequestToolbarInputDialog } from "./ui/inputDialog";
import { TextSelection } from "lumenpage-state";

type GetView = () => any;
type TableCellAlign = "left" | "center" | "right" | "justify";

type TableTexts = {
  promptCellAlign: string;
  alertCellRequired: string;
  alertInvalidCellAlign: string;
};

const isTableCellTypeName = (typeName: string | null | undefined) =>
  typeName === "tableCell" || typeName === "tableHeader";

const withoutLegacyHeaderAttr = (attrs: Record<string, unknown> | null | undefined) => {
  if (!attrs || typeof attrs !== "object") {
    return {};
  }
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "header"));
};

const resolveTexts = (locale: PlaygroundLocale): TableTexts =>
  locale === "en-US"
    ? {
        promptCellAlign: "Cell alignment: left / center / right / justify",
        alertCellRequired: "Place the caret inside a table cell first",
        alertInvalidCellAlign: "Invalid cell alignment value",
      }
    : {
        promptCellAlign:
          "\u5355\u5143\u683c\u5bf9\u9f50\u65b9\u5f0f\uff1aleft / center / right / justify",
        alertCellRequired: "\u8bf7\u5148\u5c06\u5149\u6807\u653e\u5728\u8868\u683c\u5355\u5143\u683c\u5185",
        alertInvalidCellAlign: "\u5355\u5143\u683c\u5bf9\u9f50\u503c\u65e0\u6548",
      };

const parseTableSize = (raw: string | null) => {
  if (!raw || !raw.trim()) {
    return { rows: 3, cols: 3 };
  }
  const match = raw.trim().match(/^(\d+)\s*[xX*]\s*(\d+)$/);
  if (!match) {
    return null;
  }
  const rows = Number(match[1]);
  const cols = Number(match[2]);
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) {
    return null;
  }
  return {
    rows: Math.max(1, Math.min(20, Math.floor(rows))),
    cols: Math.max(1, Math.min(20, Math.floor(cols))),
  };
};

const isValidCssColor = (color: string) => {
  const value = String(color || "").trim();
  if (!value) {
    return false;
  }
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", value);
  }
  if (typeof document === "undefined") {
    return false;
  }
  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = value;
  return probe.style.color !== "";
};

const createDefaultTableNode = (view: any, rows: number, cols: number) => {
  const schema = view?.state?.schema;
  const tableType = schema?.nodes?.table;
  const rowType = schema?.nodes?.tableRow;
  const cellType = schema?.nodes?.tableCell;
  const paragraphType = schema?.nodes?.paragraph;
  if (!tableType || !rowType || !cellType || !paragraphType) {
    return null;
  }

  const createParagraph = () => paragraphType.createAndFill?.() ?? paragraphType.create?.() ?? null;
  const createCell = () => {
    const paragraph = createParagraph();
    return (
      cellType.createAndFill?.(null, paragraph ? [paragraph] : undefined) ??
      cellType.create?.(null, paragraph ? [paragraph] : undefined) ??
      null
    );
  };

  const tableRows = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const cells = [];
    for (let colIndex = 0; colIndex < cols; colIndex += 1) {
      const cell = createCell();
      if (!cell) {
        return null;
      }
      cells.push(cell);
    }
    tableRows.push(rowType.create(null, cells));
  }
  return tableType.createAndFill?.(null, tableRows) ?? tableType.create?.(null, tableRows) ?? null;
};

const createEmptyParagraphNode = (schema: any) => {
  const paragraphType = schema?.nodes?.paragraph;
  if (!paragraphType) {
    return null;
  }
  return paragraphType.createAndFill?.() ?? paragraphType.create?.() ?? null;
};

const isParagraphNode = (node: any) => node?.type?.name === "paragraph";

const findTablePosAround = (doc: any, pos: number) => {
  if (!doc || !Number.isFinite(pos)) {
    return null;
  }
  const maxPos = Number(doc.content?.size ?? 0);
  const seeds = [pos, pos - 1, pos + 1, pos - 2, pos + 2];
  for (const seed of seeds) {
    const candidate = Math.max(0, Math.min(maxPos, seed));
    const direct = doc.nodeAt(candidate);
    if (direct?.type?.name === "table") {
      return candidate;
    }
    const $pos = doc.resolve(candidate);
    const before = $pos.nodeBefore;
    if (before?.type?.name === "table") {
      return candidate - before.nodeSize;
    }
    const after = $pos.nodeAfter;
    if (after?.type?.name === "table") {
      return candidate;
    }
  }
  return null;
};

const replaceSelectionWithTableAndParagraphs = (view: any, tableNode: any) => {
  const state = view?.state;
  if (!state?.tr || !tableNode) {
    return false;
  }
  const from = Number(state.selection?.from);
  if (!Number.isFinite(from)) {
    return false;
  }
  const paragraphType = state.schema?.nodes?.paragraph;
  let tr = state.tr.replaceSelectionWith(tableNode, false);
  let tablePos = findTablePosAround(tr.doc, tr.mapping.map(from, -1));
  if (!Number.isFinite(tablePos)) {
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  const ensureParagraph = () =>
    paragraphType?.createAndFill?.() ?? paragraphType?.create?.() ?? null;

  const $before = tr.doc.resolve(tablePos);
  if (!isParagraphNode($before.nodeBefore)) {
    const paragraphBefore = ensureParagraph();
    if (paragraphBefore) {
      tr = tr.insert(tablePos, paragraphBefore);
      tablePos += paragraphBefore.nodeSize;
    }
  }

  const insertedTable = tr.doc.nodeAt(tablePos);
  if (!insertedTable || insertedTable.type?.name !== "table") {
    view.dispatch(tr.scrollIntoView());
    return true;
  }
  const afterPos = tablePos + insertedTable.nodeSize;
  const $after = tr.doc.resolve(afterPos);
  let trailingParagraphPos = afterPos;
  if (!isParagraphNode($after.nodeAfter)) {
    const paragraphAfter = ensureParagraph();
    if (paragraphAfter) {
      tr = tr.insert(afterPos, paragraphAfter);
    } else {
      trailingParagraphPos = null;
    }
  }
  if (Number.isFinite(trailingParagraphPos)) {
    try {
      tr = tr.setSelection(TextSelection.create(tr.doc, trailingParagraphPos + 1));
    } catch (_error) {
      // Keep transaction selection when mapping near document boundary fails.
    }
  }
  view.dispatch(tr.scrollIntoView());
  return true;
};

const forEachTableCell = (
  table: any,
  tablePos: number,
  callback: (payload: { cell: any; pos: number; rowIndex: number; colIndex: number }) => void
) => {
  let rowPos = tablePos + 1;
  for (let rowIndex = 0; rowIndex < table.childCount; rowIndex += 1) {
    const row = table.child(rowIndex);
    let cellPos = rowPos + 1;
    for (let colIndex = 0; colIndex < row.childCount; colIndex += 1) {
      const cell = row.child(colIndex);
      callback({ cell, pos: cellPos, rowIndex, colIndex });
      cellPos += cell.nodeSize;
    }
    rowPos += row.nodeSize;
  }
};

const resolveTableCellPos = (table: any, tablePos: number, rowIndex: number, colIndex: number) => {
  if (!table || !Number.isFinite(table?.childCount) || table.childCount <= 0) {
    return null;
  }
  const safeRowIndex = Math.max(0, Math.min(table.childCount - 1, rowIndex));
  const row = table.child(safeRowIndex);
  if (!row || !Number.isFinite(row?.childCount) || row.childCount <= 0) {
    return null;
  }
  const safeColIndex = Math.max(0, Math.min(row.childCount - 1, colIndex));
  let pos = tablePos + 1;
  for (let r = 0; r < safeRowIndex; r += 1) {
    pos += table.child(r).nodeSize;
  }
  pos += 1;
  for (let c = 0; c < safeColIndex; c += 1) {
    pos += row.child(c).nodeSize;
  }
  return pos;
};

type TableGridAnchor = {
  pos: number;
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
  rowIndex: number;
  colIndex: number;
};

type TableGrid = {
  matrix: TableGridAnchor[][];
  anchors: TableGridAnchor[];
  byPos: Map<number, TableGridAnchor>;
};

const getTableCellSpan = (cell: any, key: "rowspan" | "colspan") => {
  const value = cell?.attrs?.[key];
  return Number.isFinite(value) && value > 0 ? value : 1;
};

const buildTableGrid = (table: any, tablePos: number): TableGrid => {
  const matrix: TableGridAnchor[][] = [];
  const anchors: TableGridAnchor[] = [];
  const byPos = new Map<number, TableGridAnchor>();

  const ensureRow = (rowIndex: number) => {
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
      const rowspan = getTableCellSpan(cell, "rowspan");
      const colspan = getTableCellSpan(cell, "colspan");
      const pos = resolveTableCellPos(table, tablePos, rowIndex, colIndex);
      if (!Number.isFinite(pos)) {
        logicalCol += colspan;
        continue;
      }

      const entry: TableGridAnchor = {
        pos,
        row: rowIndex,
        col: logicalCol,
        rowspan,
        colspan,
        rowIndex,
        colIndex,
      };
      anchors.push(entry);
      byPos.set(pos, entry);

      for (let dr = 0; dr < rowspan; dr += 1) {
        const targetRow = ensureRow(rowIndex + dr);
        for (let dc = 0; dc < colspan; dc += 1) {
          targetRow[logicalCol + dc] = entry;
        }
      }
      logicalCol += colspan;
    }
  }

  return { matrix, anchors, byPos };
};

const findAnchorCoveringCol = (grid: TableGrid, row: number, col: number) => {
  const rowItems = grid.matrix[row];
  if (!rowItems || col < 0 || col >= rowItems.length) {
    return null;
  }
  return rowItems[col] || null;
};

const findCellLocationByPos = (grid: TableGrid, cellPos: number) => {
  const entry = grid.byPos.get(cellPos);
  if (!entry) {
    return null;
  }
  return { row: entry.row, col: entry.col };
};

const getCellSelectionRect = (state: any, grid: TableGrid) => {
  const selection = state?.selection;
  const jsonType = selection?.toJSON?.()?.type;
  if (jsonType !== "tableCell") {
    return null;
  }
  const anchorPos = Number(selection?.anchor);
  const headPos = Number(selection?.head);
  if (!Number.isFinite(anchorPos) || !Number.isFinite(headPos)) {
    return null;
  }
  const anchor = findCellLocationByPos(grid, anchorPos);
  const head = findCellLocationByPos(grid, headPos);
  if (!anchor || !head) {
    return null;
  }
  return {
    top: Math.min(anchor.row, head.row),
    bottom: Math.max(anchor.row, head.row),
    left: Math.min(anchor.col, head.col),
    right: Math.max(anchor.col, head.col),
  };
};

const collectSelectionAnchors = (
  grid: TableGrid,
  rect: { top: number; bottom: number; left: number; right: number }
) => {
  const entries = new Map<number, TableGridAnchor>();
  for (let row = rect.top; row <= rect.bottom; row += 1) {
    for (let col = rect.left; col <= rect.right; col += 1) {
      const entry = findAnchorCoveringCol(grid, row, col);
      if (entry) {
        entries.set(entry.pos, entry);
      }
    }
  }
  return Array.from(entries.values());
};

const resolveCellTargets = (context: {
  currentAnchor: TableGridAnchor | null;
  selectedAnchors: TableGridAnchor[];
}) =>
  context.selectedAnchors.length > 0
    ? context.selectedAnchors
    : context.currentAnchor
      ? [context.currentAnchor]
      : [];

const normalizeCellAlign = (value: unknown): TableCellAlign | null => {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (text === "left" || text === "l" || text === "1") {
    return "left";
  }
  if (text === "center" || text === "middle" || text === "c" || text === "2") {
    return "center";
  }
  if (text === "right" || text === "r" || text === "3") {
    return "right";
  }
  if (text === "justify" || text === "distributed" || text === "j" || text === "4") {
    return "justify";
  }
  return null;
};

export const createTableActions = ({
  getView,
  getLocaleKey,
  requestInputDialog,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const insertTable = async () => {
    const view = getView();
    if (!view?.state?.tr) {
      return false;
    }
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Insert Table" : "\u63d2\u5165\u8868\u683c",
      fields: [
        {
          key: "size",
          label: getLocaleKey() === "en-US" ? "Table size (rows x columns)" : "\u8868\u683c\u5c3a\u5bf8\uff08\u884cx\u5217\uff09",
          defaultValue: "3x3",
          required: true,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const tableSize = parseTableSize(result.size || "");
    if (!tableSize) {
      return false;
    }
    const tableNode = createDefaultTableNode(view, tableSize.rows, tableSize.cols);
    if (!tableNode) {
      return false;
    }
    return replaceSelectionWithTableAndParagraphs(view, tableNode);
  };

  const deleteCurrentTable = () => {
    const view = getView();
    const state = view?.state;
    if (!state?.selection?.$from || !state?.tr) {
      return false;
    }
    const $from = state.selection.$from;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth)?.type?.name !== "table") {
        continue;
      }
      const tablePos = $from.before(depth);
      const tableNode = $from.node(depth);
      let tr = state.tr;
      const paragraphType = state.schema.nodes.paragraph;
      const paragraph = paragraphType?.createAndFill?.() ?? paragraphType?.create?.() ?? null;
      tr = paragraph
        ? tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, paragraph)
        : tr.delete(tablePos, tablePos + tableNode.nodeSize);
      view.dispatch(tr.scrollIntoView());
      return true;
    }
    return false;
  };

  const resolveTableContext = () => {
    const view = getView();
    const state = view?.state;
    const $from = state?.selection?.$from;
    if (!state || !$from) {
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
    const grid = buildTableGrid(table, tablePos);
    const rowIndex = Number($from.index(tableDepth)) || 0;
    const rowDepth = tableDepth + 1;
    const colIndex = rowDepth <= $from.depth ? Number($from.index(rowDepth)) || 0 : 0;
    const cellPos = resolveTableCellPos(table, tablePos, rowIndex, colIndex);
    const cellSelectionRect = getCellSelectionRect(state, grid);
    const selectedAnchors = cellSelectionRect
      ? collectSelectionAnchors(grid, cellSelectionRect)
      : [];
    const currentAnchor = Number.isFinite(cellPos) ? grid.byPos.get(cellPos) || null : null;
    return {
      view,
      state,
      table,
      tablePos,
      grid,
      rowIndex,
      colIndex,
      cellPos,
      currentAnchor,
      selectedAnchors,
    };
  };

  const toggleTableHeaderAttrs = (
    context: NonNullable<ReturnType<typeof resolveTableContext>>,
    predicate: (payload: { rowIndex: number; colIndex: number; cell: any }) => boolean
  ) => {
    const targets: Array<{ cell: any; pos: number; rowIndex: number; colIndex: number }> = [];
    forEachTableCell(context.table, context.tablePos, (payload) => {
      if (predicate(payload)) {
        targets.push(payload);
      }
    });
    if (targets.length === 0) {
      return false;
    }
    const tableCellType = context.state.schema?.nodes?.tableCell;
    const tableHeaderType = context.state.schema?.nodes?.tableHeader;
    if (!tableCellType || !tableHeaderType) {
      return false;
    }
    const shouldEnable = targets.some((item) => item.cell?.type?.name !== "tableHeader");
    let tr = context.state.tr;
    for (const target of targets) {
      const targetType = shouldEnable ? tableHeaderType : tableCellType;
      const attrs = withoutLegacyHeaderAttr(target.cell.attrs || {});
      tr = tr.setNodeMarkup(target.pos, targetType, attrs, target.cell.marks);
    }
    context.view.dispatch(tr.scrollIntoView());
    return true;
  };

  const toggleHeaderRow = () => {
    const context = resolveTableContext();
    if (!context) {
      return false;
    }
    return toggleTableHeaderAttrs(context, ({ rowIndex }) => rowIndex === context.rowIndex);
  };

  const toggleHeaderColumn = () => {
    const context = resolveTableContext();
    if (!context) {
      return false;
    }
    return toggleTableHeaderAttrs(context, ({ colIndex }) => colIndex === context.colIndex);
  };

  const toggleHeaderCell = () => {
    const context = resolveTableContext();
    if (!context) {
      return false;
    }
    return toggleTableHeaderAttrs(
      context,
      ({ rowIndex, colIndex }) => rowIndex === context.rowIndex && colIndex === context.colIndex
    );
  };

  const getCurrentCellBackgroundColor = () => {
    const context = resolveTableContext();
    if (!context) {
      return null;
    }
    const targets = resolveCellTargets(context);
    if (targets.length === 0) {
      return null;
    }
    let uniform: string | null | undefined = undefined;
    for (const target of targets) {
      const cellNode = context.state.doc.nodeAt(target.pos);
      if (!cellNode || !isTableCellTypeName(cellNode.type?.name)) {
        continue;
      }
      const value = String(cellNode.attrs?.background || "").trim() || null;
      if (uniform === undefined) {
        uniform = value;
        continue;
      }
      if (uniform !== value) {
        return null;
      }
    }
    return uniform ?? null;
  };

  const setCurrentCellBackgroundColor = (color: string | null) => {
    const context = resolveTableContext();
    if (!context) {
      return false;
    }
    const targets = resolveCellTargets(context);
    if (targets.length === 0) {
      return false;
    }
    const next = String(color || "").trim();
    if (next && !isValidCssColor(next)) {
      return false;
    }
    let tr = context.state.tr;
    let changed = false;
    for (const target of targets) {
      const cellNode = context.state.doc.nodeAt(target.pos);
      if (!cellNode || !isTableCellTypeName(cellNode.type?.name)) {
        continue;
      }
      const current = String(cellNode.attrs?.background || "").trim();
      if ((current || null) === (next || null)) {
        continue;
      }
      const attrs = { ...(cellNode.attrs || {}) } as Record<string, unknown>;
      attrs.background = next || null;
      tr = tr.setNodeMarkup(target.pos, undefined, attrs, cellNode.marks);
      changed = true;
    }
    if (!changed) {
      return true;
    }
    context.view.dispatch(tr.scrollIntoView());
    return true;
  };

  const forEachAlignableBlockInCell = (
    context: NonNullable<ReturnType<typeof resolveTableContext>>,
    cellPos: number,
    callback: (node: any, pos: number) => void
  ) => {
    const cellNode = context.state.doc.nodeAt(cellPos);
    if (!cellNode || !isTableCellTypeName(cellNode.type?.name)) {
      return;
    }
    cellNode.descendants((node: any, relativePos: number) => {
      if (node.type?.name === "paragraph" || node.type?.name === "heading") {
        callback(node, cellPos + 1 + relativePos);
      }
      return true;
    });
  };

  const getCurrentCellsAlign = (context: NonNullable<ReturnType<typeof resolveTableContext>>) => {
    const targets = resolveCellTargets(context);
    if (targets.length === 0) {
      return null;
    }
    let uniform: TableCellAlign | null | undefined = undefined;
    for (const target of targets) {
      forEachAlignableBlockInCell(context, target.pos, (node) => {
        const align = normalizeCellAlign(node?.attrs?.align) || "left";
        if (uniform === undefined) {
          uniform = align;
          return;
        }
        if (uniform !== align) {
          uniform = null;
        }
      });
      if (uniform === null) {
        return null;
      }
    }
    return uniform ?? null;
  };

  const setCurrentCellsAlign = (align: TableCellAlign) => {
    const context = resolveTableContext();
    if (!context) {
      return false;
    }
    const targets = resolveCellTargets(context);
    if (targets.length === 0) {
      return false;
    }
    let tr = context.state.tr;
    let changed = false;
    for (const target of targets) {
      forEachAlignableBlockInCell(context, target.pos, (node, pos) => {
        const currentAlign = normalizeCellAlign(node?.attrs?.align) || "left";
        if (currentAlign === align) {
          return;
        }
        const attrs = { ...(node.attrs || {}), align };
        tr = tr.setNodeMarkup(pos, undefined, attrs, node.marks);
        changed = true;
      });
    }
    if (!changed) {
      return true;
    }
    context.view.dispatch(tr.scrollIntoView());
    return true;
  };

  const applyCellAlignmentSetting = async () => {
    const context = resolveTableContext();
    const texts = resolveTexts(getLocaleKey());
    if (!context || resolveCellTargets(context).length === 0) {
      window.alert(texts.alertCellRequired);
      return false;
    }
    const current = getCurrentCellsAlign(context) || "left";
    const result = await requestInputDialog({
      title: getLocaleKey() === "en-US" ? "Cell Alignment" : "\u5355\u5143\u683c\u5bf9\u9f50",
      fields: [
        {
          key: "align",
          label: texts.promptCellAlign,
          type: "select",
          options:
            getLocaleKey() === "en-US"
              ? [
                  { label: "Left", value: "left" },
                  { label: "Center", value: "center" },
                  { label: "Right", value: "right" },
                  { label: "Justify", value: "justify" },
                ]
              : [
                  { label: "左对齐", value: "left" },
                  { label: "居中", value: "center" },
                  { label: "右对齐", value: "right" },
                  { label: "两端对齐", value: "justify" },
                ],
          defaultValue: current,
          required: true,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const align = normalizeCellAlign(result.align);
    if (!align) {
      window.alert(texts.alertInvalidCellAlign);
      return false;
    }
    return setCurrentCellsAlign(align);
  };

  return {
    insertTable,
    deleteCurrentTable,
    toggleHeaderRow,
    toggleHeaderColumn,
    toggleHeaderCell,
    applyCellAlignmentSetting,
    getCurrentCellBackgroundColor,
    setCurrentCellBackgroundColor,
  };
};

export default createTableActions;




