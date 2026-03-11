import { Node } from "lumenpage-core";
import { imageNodeSpec, imageRenderer } from "./image";

export { imageNodeSpec, imageRenderer, serializeImageToText } from "./image";

export const Image = Node.create({
  name: "image",
  priority: 100,
  schema: imageNodeSpec,
  layout() {
    return {
      renderer: imageRenderer,
      pagination: imageRenderer?.pagination,
    };
  },
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
