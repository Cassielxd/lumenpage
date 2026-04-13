import { Extension } from "../Extension.js";

export const Keymap = Extension.create({
  name: "keymap",
  addKeyboardShortcuts() {
    const handleBackspace = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.deleteSelection(),
        () => commands.joinBackward(),
        () => commands.selectNodeBackward(),
      ]);

    const handleDelete = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.deleteSelection(),
        () => commands.joinForward(),
        () => commands.selectNodeForward(),
      ]);

    const handleEnter = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.newlineInCode(),
        () => commands.createParagraphNear(),
        () => commands.liftEmptyBlock(),
        () => commands.splitBlock(),
      ]);

    return {
      Enter: handleEnter,
      Backspace: handleBackspace,
      "Mod-Backspace": handleBackspace,
      "Shift-Backspace": handleBackspace,
      Delete: handleDelete,
      "Mod-Delete": handleDelete,
      "Mod-a": () => this.editor.commands.selectAll(),
    };
  },
});

export default Keymap;
