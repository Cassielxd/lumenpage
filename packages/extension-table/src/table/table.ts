import { Node } from "lumenpage-core";
import {
  addTableColumnAfter,
  addTableColumnBefore,
  addTableRowAfter,
  addTableRowBefore,
  CellSelection,
  createTableSelectionGeometry,
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
  tableRenderer,
} from "./implementation";

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
  addLayout() {
    return {
      renderer: tableRenderer,
      pagination: tableRenderer?.pagination,
    };
  },
  addCanvas() {
    return {
      selectionGeometries: [createTableSelectionGeometry()],
    };
  },
});

export default Table;
