import { Node } from "lumenpage-core";
import { videoNodeSpec, videoRenderer } from "./video";

export { videoNodeSpec, videoRenderer, serializeVideoToText } from "./video";

export const Video = Node.create({
  name: "video",
  priority: 100,
  schema: videoNodeSpec,
  addLayout() {
    return {
      renderer: videoRenderer,
      pagination: videoRenderer?.pagination,
    };
  },
  addNodeView() {
    return videoRenderer?.createNodeView;
  },
  addCanvas() {
    return {
      nodeSelectionTypes: ["video"],
    };
  },
});

export default Video;
