import { Node } from "lumenpage-core";
import { NodeSelection } from "lumenpage-state";
import {
  addTableColumnAfter,
  addTableColumnBefore,
  addTableRowAfter,
  addTableRowBefore,
  deleteTableCellSelection,
  deleteTableColumn,
  deleteTableRow,
  enterTableCellSelection,
  goToNextTableCell,
  goToPreviousTableCell,
  mergeSelectedTableCells,
  mergeTableCellRight,
  preventDeleteBackwardAtTableCellBoundary,
  preventDeleteForwardAtTableCellBoundary,
  selectCurrentAndBelowTableCell,
  selectCurrentAndNextTableCell,
  splitTableCell,
} from "./commands";
import { CellSelection } from "./cellSelection";
import { getTableTextLength, serializeTableToText, tableNodeSpecs } from "./specs";
import { defaultTableRenderer as tableRenderer } from "lumenpage-render-engine";
import {
  createDefaultTableSelectionGeometry as createTableSelectionGeometry,
} from "lumenpage-view-canvas";

type TableCommands<ReturnType> = {
  addTableRowAfter: () => ReturnType;
  addTableRowBefore: () => ReturnType;
  deleteTableRow: () => ReturnType;
  addTableColumnAfter: () => ReturnType;
  addTableColumnBefore: () => ReturnType;
  deleteTableColumn: () => ReturnType;
  goToNextTableCell: () => ReturnType;
  goToPreviousTableCell: () => ReturnType;
  mergeTableCellRight: () => ReturnType;
  splitTableCell: () => ReturnType;
  selectTableCellsRight: () => ReturnType;
  selectTableCellsDown: () => ReturnType;
  mergeSelectedTableCells: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    table: TableCommands<ReturnType>;
  }
}

const findCutBefore = ($pos) => {
  if (!$pos?.parent || $pos.parent.type?.spec?.isolating) {
    return null;
  }
  for (let depth = $pos.depth - 1; depth >= 0; depth -= 1) {
    if ($pos.index(depth) > 0) {
      return $pos.doc.resolve($pos.before(depth + 1));
    }
    if ($pos.node(depth)?.type?.spec?.isolating) {
      break;
    }
  }
  return null;
};

const findCutAfter = ($pos) => {
  if (!$pos?.parent || $pos.parent.type?.spec?.isolating) {
    return null;
  }
  for (let depth = $pos.depth - 1; depth >= 0; depth -= 1) {
    const parent = $pos.node(depth);
    if ($pos.index(depth) + 1 < parent.childCount) {
      return $pos.doc.resolve($pos.after(depth + 1));
    }
    if (parent.type?.spec?.isolating) {
      break;
    }
  }
  return null;
};

const selectAdjacentTable = (editor, direction) => {
  const view = editor?.view ?? null;
  const state = view?.state ?? editor?.state ?? null;
  const selection = state?.selection ?? null;
  const $head = selection?.$head ?? null;
  if (!view || !state || !selection?.empty || !$head?.parent?.isTextblock) {
    return false;
  }

  const isBackward = direction === "backward";
  const atBoundary = isBackward
    ? $head.parentOffset === 0
    : $head.parentOffset === $head.parent.content.size;
  if (!atBoundary) {
    return false;
  }

  const $cut = isBackward ? findCutBefore($head) : findCutAfter($head);
  const adjacentNode = isBackward ? $cut?.nodeBefore : $cut?.nodeAfter;
  if (!adjacentNode || adjacentNode.type?.name !== "table") {
    return false;
  }

  const selectionPos = isBackward ? $cut.pos - adjacentNode.nodeSize : $cut.pos;
  try {
    const tr = state.tr.setSelection(NodeSelection.create(state.doc, selectionPos)).scrollIntoView();
    view.dispatch(tr);
    return true;
  } catch (_error) {
    return false;
  }
};

export const tableNodeSpec = tableNodeSpecs.table;
export { CellSelection, getTableTextLength, serializeTableToText, tableRenderer };
export {
  addTableColumnAfter,
  addTableColumnBefore,
  addTableRowAfter,
  addTableRowBefore,
  deleteTableCellSelection,
  deleteTableColumn,
  deleteTableRow,
  enterTableCellSelection,
  goToNextTableCell,
  goToPreviousTableCell,
  mergeSelectedTableCells,
  mergeTableCellRight,
  preventDeleteBackwardAtTableCellBoundary,
  preventDeleteForwardAtTableCellBoundary,
  selectCurrentAndBelowTableCell,
  selectCurrentAndNextTableCell,
  splitTableCell,
};

export const Table = Node.create({
  name: "table",
  priority: 1000,
  schema: tableNodeSpec,
  addKeyboardShortcuts() {
    const handleBackward = () => selectAdjacentTable(this.editor, "backward");
    const handleForward = () => selectAdjacentTable(this.editor, "forward");

    return {
      Backspace: handleBackward,
      "Mod-Backspace": handleBackward,
      "Shift-Backspace": handleBackward,
      Delete: handleForward,
      "Mod-Delete": handleForward,
    };
  },
  addCommands() {
    return {
      addTableRowAfter: () => addTableRowAfter,
      addTableRowBefore: () => addTableRowBefore,
      deleteTableRow: () => deleteTableRow,
      addTableColumnAfter: () => addTableColumnAfter,
      addTableColumnBefore: () => addTableColumnBefore,
      deleteTableColumn: () => deleteTableColumn,
      goToNextTableCell: () => goToNextTableCell,
      goToPreviousTableCell: () => goToPreviousTableCell,
      mergeTableCellRight: () => mergeTableCellRight,
      splitTableCell: () => splitTableCell,
      selectTableCellsRight: () => selectCurrentAndNextTableCell,
      selectTableCellsDown: () => selectCurrentAndBelowTableCell,
      mergeSelectedTableCells: () => mergeSelectedTableCells,
    };
  },
  canvas() {
    return {
      selectionGeometries: [createTableSelectionGeometry()],
    };
  },
});

export default Table;
