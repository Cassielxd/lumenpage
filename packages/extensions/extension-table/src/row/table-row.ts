import { Node } from "lumenpage-core";
import { tableNodeSpecs } from "../table/specs.js";

export const tableRowNodeSpec = tableNodeSpecs.tableRow;

export const TableRow = Node.create({
  name: "tableRow",
  priority: 100,
  schema: tableRowNodeSpec,
});

export default TableRow;
