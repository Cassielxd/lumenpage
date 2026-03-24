import { Extension } from "lumenpage-core";
import { createEmbedPanelNodeView } from "./nodeView";

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

export { createEmbedPanelNodeView } from "./nodeView";
