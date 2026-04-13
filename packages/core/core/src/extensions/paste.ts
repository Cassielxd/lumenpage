import { Plugin, PluginKey } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import { Extension } from "../Extension.js";

export const pastePluginKey = new PluginKey("paste");

export const Paste = Extension.create({
  name: "paste",
  priority: 850,
  addPlugins() {
    return [
      new Plugin({
        key: pastePluginKey,
        props: {
          handlePaste: (view, event, slice) => {
            this.editor?.emit("paste", {
              editor: this.editor,
              event,
              slice,
              view: view as unknown as CanvasEditorView,
            });

            return false;
          },
        },
      }),
    ];
  },
});

export default Paste;
