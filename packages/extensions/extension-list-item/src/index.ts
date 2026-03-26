import { Node } from "lumenpage-core";
import {
  backspaceEmptyListItem,
  createToggleListCommand,
  splitListItem,
  toggleTaskItemChecked,
} from "./list/commands";
import { listNodeSpecs } from "./list/specs";

type ListItemCommands<ReturnType> = {
  splitListItem: () => ReturnType;
  backspaceEmptyListItem: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    listItem: ListItemCommands<ReturnType>;
  }
}

export { serializeListToText, containerOffsetMapping } from "./list/offsetMapping";
export {
  defaultBulletListRenderer as bulletListRenderer,
  defaultOrderedListRenderer as orderedListRenderer,
  defaultTaskListRenderer as taskListRenderer,
} from "lumenpage-render-engine";
export { listNodeSpecs } from "./list/specs";
export {
  backspaceEmptyListItem,
  createToggleListCommand,
  splitListItem,
  toggleTaskItemChecked,
} from "./list/commands";

export const listItemNodeSpec = listNodeSpecs.listItem;
export const taskItemNodeSpec = listNodeSpecs.taskItem;

export const ListItem = Node.create({
  name: "listItem",
  priority: 100,
  schema: listItemNodeSpec,
  addCommands() {
    return {
      splitListItem: () => splitListItem,
      backspaceEmptyListItem: () => backspaceEmptyListItem,
    };
  },
});

export default ListItem;