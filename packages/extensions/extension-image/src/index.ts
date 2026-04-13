import { Node } from "lumenpage-core";
import { defaultImageRenderer as imageRenderer } from "lumenpage-render-engine";
import { createDefaultImageNodeView } from "lumenpage-view-canvas";
import { imageNodeSpec } from "./image.js";

type ImageCommands<ReturnType> = {
  setImage: (attributes?: Record<string, unknown>) => ReturnType;
  insertImage: (attributes?: Record<string, unknown>) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    image: ImageCommands<ReturnType>;
  }
}

export { imageNodeSpec };
export { serializeImageToText } from "./image.js";
export { defaultImageRenderer as imageRenderer } from "lumenpage-render-engine";

export const Image = Node.create({
  name: "image",
  priority: 100,
  schema: imageNodeSpec,
  addCommands() {
    const insertImage =
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
      setImage: insertImage,
      insertImage,
    };
  },
  addNodeView() {
    return createDefaultImageNodeView;
  },
  canvas() {
    return {
      nodeSelectionTypes: ["image"],
    };
  },
});

export default Image;