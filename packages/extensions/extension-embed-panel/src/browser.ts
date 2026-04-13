import { Extension } from "lumenpage-core";
import { createEmbedPanelNodeView } from "./nodeView.js";

export const EmbedPanelBrowserViewExtension = Extension.create({
  name: "embedPanelBrowserView",
  canvas() {
    return {
      nodeViews: {
        embedPanel: createEmbedPanelNodeView,
      },
    };
  },
});

export { createEmbedPanelNodeView } from "./nodeView.js";
