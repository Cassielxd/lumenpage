import { Node } from "lumenpage-core";
import { defaultVideoRenderer as videoRenderer } from "lumenpage-view-canvas";
import { videoNodeSpec } from "./video";

export { videoNodeSpec };
export { serializeVideoToText } from "./video";
export { defaultVideoRenderer as videoRenderer } from "lumenpage-view-canvas";

export const Video = Node.create({
  name: "video",
  priority: 100,
  schema: videoNodeSpec,
  addNodeView() {
    return videoRenderer?.createNodeView;
  },
  canvas() {
    return {
      nodeSelectionTypes: ["video"],
    };
  },
});

export default Video;
