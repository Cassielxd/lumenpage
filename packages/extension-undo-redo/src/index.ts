import { Extension } from "lumenpage-core";
import { history } from "lumenpage-history";

export const UndoRedo = Extension.create({
  name: "undoRedo",
  priority: 900,
  addProseMirrorPlugins() {
    return [history()];
  },
});

export default UndoRedo;
