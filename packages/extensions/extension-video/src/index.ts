import { Node } from "lumenpage-core";
import { defaultVideoRenderer as videoRenderer } from "lumenpage-render-engine";
import { createDefaultVideoNodeView } from "lumenpage-view-canvas";
import { videoNodeSpec } from "./video.js";

type VideoCommands<ReturnType> = {
  setVideo: (attributes?: Record<string, unknown>) => ReturnType;
  insertVideo: (attributes?: Record<string, unknown>) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    video: VideoCommands<ReturnType>;
  }
}

export { videoNodeSpec };
export { serializeVideoToText } from "./video.js";
export { defaultVideoRenderer as videoRenderer } from "lumenpage-render-engine";

export const Video = Node.create({
  name: "video",
  priority: 100,
  schema: videoNodeSpec,
  addCommands() {
    const insertVideo =
      (attributes: Record<string, unknown> = {}) =>
      ({ state, dispatch }) => {
        const type = state.schema.nodes[this.name];

        if (!type) {
          return false;
        }

        if (dispatch) {
          dispatch(state.tr.replaceSelectionWith(type.create(attributes)).scrollIntoView());
        }

        return true;
      };

    return {
      setVideo: insertVideo,
      insertVideo,
    };
  },
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