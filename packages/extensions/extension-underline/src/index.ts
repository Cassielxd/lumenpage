import { EDITOR_SHORTCUTS, Mark } from "lumenpage-core";

type UnderlineCommands<ReturnType> = {
  setUnderline: () => ReturnType;
  toggleUnderline: () => ReturnType;
  unsetUnderline: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    underline: UnderlineCommands<ReturnType>;
  }
}

export const Underline = Mark.create({
  name: "underline",
  priority: 100,
  addCommands() {
    return {
      setUnderline: () => ({ commands }) => commands.setMark(this.name),
      toggleUnderline: () => ({ commands }) => commands.toggleMark(this.name),
      unsetUnderline: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return {
      [EDITOR_SHORTCUTS.toggleUnderline[0]]: () => this.editor.commands.toggleUnderline(),
    };
  },
  parseHTML() {
    return [
      { tag: "u" },
      {
        style: "text-decoration",
        getAttrs: (value) => (value && value.includes("underline") ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["u", HTMLAttributes, 0];
  },
});

export default Underline;
