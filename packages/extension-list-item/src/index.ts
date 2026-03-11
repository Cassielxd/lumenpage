import { Node } from "lumenpage-core";
import { backspaceEmptyListItem, splitListItem } from "./list/commands";
import { listNodeSpecs } from "./list/specs";

export { serializeListToText, containerOffsetMapping } from "./list/offsetMapping";
export { bulletListRenderer, orderedListRenderer, taskListRenderer } from "./list/renderer";
export { listNodeSpecs } from "./list/specs";
export { backspaceEmptyListItem, splitListItem, toggleTaskItemChecked } from "./list/commands";

export const listItemNodeSpec = listNodeSpecs.listItem;
export const taskItemNodeSpec = listNodeSpecs.taskItem;

export const ListItem = Node.create({
  name: "listItem",
  priority: 100,
  schema: listItemNodeSpec,
});

export default ListItem;
