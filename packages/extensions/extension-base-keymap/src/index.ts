import { baseKeymap } from "lumenpage-commands";
import { Extension } from "lumenpage-core";

export const BaseKeymap = Extension.create({
  name: "baseKeymap",
  priority: 800,
  addKeyboardShortcuts() {
    return baseKeymap;
  },
});

export const BaseKeymapExtension = BaseKeymap;

export default BaseKeymap;
