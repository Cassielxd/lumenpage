import { EDITOR_SHORTCUTS, Node } from "lumenpage-core";
import { blockquoteNodeSpec } from "./blockquote.js";

type BlockquoteCommands<ReturnType> = {
  setBlockquote: () => ReturnType;
  toggleBlockquote: () => ReturnType;
  unsetBlockquote: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    blockquote: BlockquoteCommands<ReturnType>;
  }
}

export { blockquoteNodeSpec };
export { defaultBlockquoteRenderer as blockquoteRenderer } from "lumenpage-render-engine";

export const Blockquote = Node.create({
  name: "blockquote",
  priority: 100,
  content: "block+",
  group: "block",
  addCommands() {
    return {
      setBlockquote: () => ({ commands }) => commands.wrapIn(this.name),
      toggleBlockquote: () => ({ commands }) => commands.toggleWrap(this.name),
      unsetBlockquote:
        () =>
        ({ state, commands }) => {
          const selection = state.selection as typeof state.selection & {
            $from: {
              depth: number;
              node: (depth: number) => { type: { name: string } } | null;
            };
          };

          for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
            if (selection.$from.node(depth)?.type?.name === this.name) {
              return commands.toggleWrap(this.name);
            }
          }

          return false;
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      [EDITOR_SHORTCUTS.toggleBlockquote[0]]: () => this.editor.commands.toggleBlockquote(),
    };
  },
  parseHTML() {
    return [{ tag: "blockquote" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["blockquote", HTMLAttributes, 0];
  },
  schema: {
    offsetMapping: blockquoteNodeSpec.offsetMapping,
  },
});

export default Blockquote;
