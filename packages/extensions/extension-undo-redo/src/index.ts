import { Extension } from "lumenpage-core";
import { history, redo, undo } from "lumenpage-history";

type UndoRedoCommands<ReturnType> = {
  undo: () => ReturnType;
  redo: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    undoRedo: UndoRedoCommands<ReturnType>;
  }
}

export const UndoRedo = Extension.create({
  name: "undoRedo",
  priority: 900,
  addCommands() {
    return {
      undo: () => undo,
      redo: () => redo,
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-z": () => this.editor?.commands.undo?.() === true,
      "Mod-y": () => this.editor?.commands.redo?.() === true,
      "Shift-Mod-z": () => this.editor?.commands.redo?.() === true,
    };
  },
  addPlugins() {
    return [history()];
  },
});

export default UndoRedo;