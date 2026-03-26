import { Mark } from "lumenpage-core";

type SubscriptCommands<ReturnType> = {
  setSubscript: () => ReturnType;
  toggleSubscript: () => ReturnType;
  unsetSubscript: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    subscript: SubscriptCommands<ReturnType>;
  }
}

export const Subscript = Mark.create({
  name: "subscript",
  priority: 100,
  addCommands() {
    return {
      setSubscript:
        () =>
        ({ chain }) =>
          chain().unsetMark("superscript").setMark(this.name).run(),
      toggleSubscript:
        () =>
        ({ chain }) =>
          chain().unsetMark("superscript").toggleMark(this.name).run(),
      unsetSubscript: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
  parseHTML() {
    return [
      { tag: "sub" },
      {
        style: "vertical-align",
        getAttrs: (value) => (String(value || "").toLowerCase() === "sub" ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sub", HTMLAttributes, 0];
  },
});

export default Subscript;