import { Node } from "lumenpage-core";

type HardBreakCommands<ReturnType> = {
  setHardBreak: () => ReturnType;
  insertHardBreak: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    hardBreak: HardBreakCommands<ReturnType>;
  }
}

export { hardBreakNodeSpec } from "./hardBreak.js";

export const HardBreak = Node.create({
  name: "hardBreak",
  priority: 100,
  inline: true,
  group: "inline",
  selectable: false,
  atom: true,
  addCommands() {
    const insertHardBreak =
      () =>
      ({ state, dispatch }) => {
        const type = state.schema.nodes[this.name];

        if (!type) {
          return false;
        }

        if (dispatch) {
          dispatch(state.tr.replaceSelectionWith(type.create()).scrollIntoView());
        }

        return true;
      };

    return {
      setHardBreak: insertHardBreak,
      insertHardBreak,
    };
  },
  parseHTML() {
    return [{ tag: "br" }];
  },
  renderHTML() {
    return ["br"];
  },
  schema: {
    leafText: () => "\n",
  },
});

export default HardBreak;