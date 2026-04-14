import { EDITOR_SHORTCUTS, Mark } from "lumenpage-core";

type ItalicCommands<ReturnType> = {
  setItalic: () => ReturnType;
  toggleItalic: () => ReturnType;
  unsetItalic: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    italic: ItalicCommands<ReturnType>;
  }
}

export const Italic = Mark.create({
  name: "italic",
  priority: 100,
  addCommands() {
    return {
      setItalic: () => ({ commands }) => commands.setMark(this.name),
      toggleItalic: () => ({ commands }) => commands.toggleMark(this.name),
      unsetItalic: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return {
      [EDITOR_SHORTCUTS.toggleItalic[0]]: () => this.editor.commands.toggleItalic(),
    };
  },
  parseHTML() {
    return [
      { tag: "em" },
      { tag: "i" },
      {
        style: "font-style",
        getAttrs: (value) => (value === "italic" ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["em", HTMLAttributes, 0];
  },
});

export default Italic;
