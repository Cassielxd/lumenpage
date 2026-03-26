import { Mark } from "lumenpage-core";

type BoldCommands<ReturnType> = {
  setBold: () => ReturnType;
  toggleBold: () => ReturnType;
  unsetBold: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    bold: BoldCommands<ReturnType>;
  }
}

export const Bold = Mark.create({
  name: "bold",
  priority: 100,
  addCommands() {
    return {
      setBold: () => ({ commands }) => commands.setMark(this.name),
      toggleBold: () => ({ commands }) => commands.toggleMark(this.name),
      unsetBold: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
  parseHTML() {
    return [
      { tag: "strong" },
      { tag: "b" },
      {
        style: "font-weight",
        getAttrs: (value) => (value === "bold" ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["strong", HTMLAttributes, 0];
  },
});

export default Bold;