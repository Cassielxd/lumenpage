import { Node } from "lumenpage-core";
import { tableNodeSpecs } from "../table/specs.js";

export const tableHeaderNodeSpec = tableNodeSpecs.tableHeader;

export const TableHeader = Node.create({
  name: "tableHeader",
  priority: 100,
  schema: tableHeaderNodeSpec,
});

export default TableHeader;
