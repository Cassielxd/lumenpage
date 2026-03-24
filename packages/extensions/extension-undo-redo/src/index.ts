import { Extension } from "lumenpage-core";
import { history } from "lumenpage-history";

export const UndoRedo = Extension.create({
  name: "undoRedo",
  priority: 900,
  addPlugins() {
    return [history()];
  },
});

export default UndoRedo;
