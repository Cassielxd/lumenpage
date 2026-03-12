import { Node } from "lumenpage-core";
import {
  addTableColumnAfter,
  addTableColumnBefore,
  addTableRowAfter,
  addTableRowBefore,
  CellSelection,
  deleteTableCellSelection,
  deleteTableColumn,
  deleteTableRow,
  enterTableCellSelection,
  getTableTextLength,
  goToNextTableCell,
  goToPreviousTableCell,
  mergeSelectedTableCells,
  mergeTableCellRight,
  preventDeleteBackwardAtTableCellBoundary,
  preventDeleteForwardAtTableCellBoundary,
  selectCurrentAndBelowTableCell,
  selectCurrentAndNextTableCell,
  serializeTableToText,
  splitTableCell,
  tableNodeSpecs,
} from "./implementation";
import {
  createDefaultTableSelectionGeometry as createTableSelectionGeometry,
  defaultTableRenderer as tableRenderer,
} from "lumenpage-view-canvas";

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
  priority: 100,
  schema: tableNodeSpec,
  canvas() {
    return {
      selectionGeometries: [createTableSelectionGeometry()],
    };
  },
});

export default Table;
