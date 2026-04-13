import { Node } from "lumenpage-core";
import {
  backspaceEmptyListItem,
  createToggleListCommand,
  joinListItemBackward,
  splitListItem,
  toggleTaskItemChecked,
} from "./list/commands.js";
import { listNodeSpecs } from "./list/specs.js";

type ListItemCommands<ReturnType> = {
  splitListItem: () => ReturnType;
  backspaceEmptyListItem: () => ReturnType;
  joinListItemBackward: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    listItem: ListItemCommands<ReturnType>;
  }
}

export { serializeListToText, containerOffsetMapping } from "./list/offsetMapping.js";
export {
  defaultBulletListRenderer as bulletListRenderer,
  defaultOrderedListRenderer as orderedListRenderer,
  defaultTaskListRenderer as taskListRenderer,
} from "lumenpage-render-engine";
export { listNodeSpecs } from "./list/specs.js";
export {
  backspaceEmptyListItem,
  createToggleListCommand,
  joinListItemBackward,
  splitListItem,
  toggleTaskItemChecked,
} from "./list/commands.js";

export const listItemNodeSpec = listNodeSpecs.listItem;
export const taskItemNodeSpec = listNodeSpecs.taskItem;

export const ListItem = Node.create({
  name: "listItem",
  priority: 110,
  schema: listItemNodeSpec,
  addKeyboardShortcuts() {
    const handleBackward = () => this.editor.commands.joinListItemBackward();

    return {
      Backspace: handleBackward,
      "Mod-Backspace": handleBackward,
      "Shift-Backspace": handleBackward,
    };
  },
  addCommands() {
    return {
      splitListItem: () => splitListItem,
      backspaceEmptyListItem: () => backspaceEmptyListItem,
      joinListItemBackward: () => joinListItemBackward,
    };
  },
});

export default ListItem;
