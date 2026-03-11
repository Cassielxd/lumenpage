import { Extension } from "lumenpage-core";
import { createCanvasEditorKeymap } from "lumenpage-extension-editing-commands";

export const CanvasKeymap = Extension.create({
  name: "canvasKeymap",
  priority: 810,
  addKeyboardShortcuts() {
    return createCanvasEditorKeymap();
  },
});

export const CanvasKeymapExtension = CanvasKeymap;

export default CanvasKeymap;
