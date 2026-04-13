import { Plugin } from "lumenpage-state";

import { Extension } from "../Extension.js";

export const BeforeInput = Extension.create({
  name: "beforeInput",
  priority: 850,
  addPlugins() {
    return [
      new Plugin({
        props: {
          handleBeforeInput: (view, event) => this.editor?.handleCoreBeforeInput(view, event) ?? false,
        },
      }),
    ];
  },
});

export default BeforeInput;
