import { Plugin, PluginKey } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import { Extension } from "../Extension";

export const dropPluginKey = new PluginKey("drop");

export const Drop = Extension.create({
  name: "drop",
  priority: 850,
  addPlugins() {
    return [
      new Plugin({
        key: dropPluginKey,
        props: {
          handleDrop: (view, event, slice, moved) => {
            this.editor?.emit("drop", {
              editor: this.editor,
              event,
              slice,
              moved,
              view: view as unknown as CanvasEditorView,
            });

            return false;
          },
        },
      }),
    ];
  },
});

export default Drop;
