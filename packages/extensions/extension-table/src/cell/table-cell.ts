import { Node } from "lumenpage-core";
import { tableNodeSpecs } from "../table/specs.js";

export const tableCellNodeSpec = tableNodeSpecs.tableCell;

export const TableCell = Node.create({
  name: "tableCell",
  priority: 100,
  schema: tableCellNodeSpec,
});

export default TableCell;
