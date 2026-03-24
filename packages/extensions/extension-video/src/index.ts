import { Node } from "lumenpage-core";
import { defaultVideoRenderer as videoRenderer } from "lumenpage-render-engine";
import { createDefaultVideoNodeView } from "lumenpage-view-canvas";
import { videoNodeSpec } from "./video";

export { videoNodeSpec };
export { serializeVideoToText } from "./video";
export { defaultVideoRenderer as videoRenderer } from "lumenpage-render-engine";

export const Video = Node.create({
  name: "video",
  priority: 100,
  schema: videoNodeSpec,
  addNodeView() {
    return createDefaultVideoNodeView;
  },
  canvas() {
    return {
      nodeSelectionTypes: ["video"],
    };
  },
});

export default Video;
