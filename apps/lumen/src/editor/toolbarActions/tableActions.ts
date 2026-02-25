import type { PlaygroundLocale } from "../i18n";

type GetView = () => any;

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

const createDefaultTableNode = (view: any, rows: number, cols: number) => {
  const schema = view?.state?.schema;
  const tableType = schema?.nodes?.table;
  const rowType = schema?.nodes?.table_row;
  const cellType = schema?.nodes?.table_cell;
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

export const createTableActions = ({
  getView,
  getLocaleKey,
}: {
  getView: GetView;
  getLocaleKey: () => PlaygroundLocale;
}) => {
  const insertTable = () => {
    const view = getView();
    if (!view?.state?.tr) {
      return false;
    }
    const promptText =
      getLocaleKey() === "en-US" ? "Table size (rows x columns)" : "请输入表格尺寸（行x列）";
    const tableSize = parseTableSize(window.prompt(promptText, "3x3"));
    if (!tableSize) {
      return false;
    }
    const tableNode = createDefaultTableNode(view, tableSize.rows, tableSize.cols);
    if (!tableNode) {
      return false;
    }
    const tr = view.state.tr.replaceSelectionWith(tableNode);
    view.dispatch(tr.scrollIntoView());
    return true;
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
    const rowIndex = Number($from.index(tableDepth)) || 0;
    const rowDepth = tableDepth + 1;
    const colIndex = rowDepth <= $from.depth ? Number($from.index(rowDepth)) || 0 : 0;
    return { view, state, table, tablePos, rowIndex, colIndex };
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
    const shouldEnable = targets.some((item) => item.cell?.attrs?.header !== true);
    let tr = context.state.tr;
    for (const target of targets) {
      const attrs = { ...(target.cell.attrs || {}), header: shouldEnable };
      tr = tr.setNodeMarkup(target.pos, undefined, attrs, target.cell.marks);
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

  return {
    insertTable,
    deleteCurrentTable,
    toggleHeaderRow,
    toggleHeaderColumn,
    toggleHeaderCell,
  };
};
