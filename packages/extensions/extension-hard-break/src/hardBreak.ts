import type { NodeSpec } from "lumenpage-model";

export const hardBreakNodeSpec: NodeSpec = {
  inline: true,
  group: "inline",
  selectable: false,
  atom: true,
  leafText: () => "\n",
  parseDOM: [
    {
      tag: "br",
    },
  ],
  toDOM() {
    return ["br"];
  },
};
