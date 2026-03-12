import { Node } from "lumenpage-core";
import { defaultImageRenderer as imageRenderer } from "lumenpage-view-canvas";
import { imageNodeSpec } from "./image";

export { imageNodeSpec };
export { serializeImageToText } from "./image";
export { defaultImageRenderer as imageRenderer } from "lumenpage-view-canvas";

export const Image = Node.create({
  name: "image",
  priority: 100,
  schema: imageNodeSpec,
  addNodeView() {
    return imageRenderer?.createNodeView;
  },
  canvas() {
    return {
      nodeSelectionTypes: ["image"],
    };
  },
});

export default Image;
