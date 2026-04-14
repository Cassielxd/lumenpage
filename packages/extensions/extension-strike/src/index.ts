import { EDITOR_SHORTCUTS, Mark } from "lumenpage-core";

type StrikeCommands<ReturnType> = {
  setStrike: () => ReturnType;
  toggleStrike: () => ReturnType;
  unsetStrike: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    strike: StrikeCommands<ReturnType>;
  }
}

export const Strike = Mark.create({
  name: "strike",
  priority: 100,
  addCommands() {
    return {
      setStrike: () => ({ commands }) => commands.setMark(this.name),
      toggleStrike: () => ({ commands }) => commands.toggleMark(this.name),
      unsetStrike: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return {
      [EDITOR_SHORTCUTS.toggleStrike[0]]: () => this.editor.commands.toggleStrike(),
    };
  },
  parseHTML() {
    return [
      { tag: "s" },
      { tag: "del" },
      { tag: "strike" },
      {
        style: "text-decoration",
        getAttrs: (value) => (value && value.includes("line-through") ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["s", HTMLAttributes, 0];
  },
});

export default Strike;
