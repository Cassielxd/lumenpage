import { EDITOR_SHORTCUTS, Node } from "lumenpage-core";
import { createToggleListCommand, listNodeSpecs } from "lumenpage-extension-list-item";

type OrderedListCommands<ReturnType> = {
  toggleOrderedList: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    orderedList: OrderedListCommands<ReturnType>;
  }
}

export const orderedListNodeSpec = listNodeSpecs.orderedList;
export { defaultOrderedListRenderer as orderedListRenderer } from "lumenpage-render-engine";

export const OrderedList = Node.create({
  name: "orderedList",
  priority: 100,
  schema: orderedListNodeSpec,
  addCommands() {
    return {
      toggleOrderedList: () => createToggleListCommand(this.name),
    };
  },
  addKeyboardShortcuts() {
    return {
      [EDITOR_SHORTCUTS.toggleOrderedList[0]]: () => this.editor.commands.toggleOrderedList(),
    };
  },
});

export default OrderedList;
