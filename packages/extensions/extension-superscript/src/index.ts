import { Mark } from "lumenpage-core";

type SuperscriptCommands<ReturnType> = {
  setSuperscript: () => ReturnType;
  toggleSuperscript: () => ReturnType;
  unsetSuperscript: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    superscript: SuperscriptCommands<ReturnType>;
  }
}

export const Superscript = Mark.create({
  name: "superscript",
  priority: 100,
  addCommands() {
    return {
      setSuperscript:
        () =>
        ({ chain }) =>
          chain().unsetMark("subscript").setMark(this.name).run(),
      toggleSuperscript:
        () =>
        ({ chain }) =>
          chain().unsetMark("subscript").toggleMark(this.name).run(),
      unsetSuperscript: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
  parseHTML() {
    return [
      { tag: "sup" },
      {
        style: "vertical-align",
        getAttrs: (value) => (String(value || "").toLowerCase() === "super" ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sup", HTMLAttributes, 0];
  },
});

export default Superscript;