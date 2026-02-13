export {
  schema,
  createDocFromText,
  docToText,
  serializeTableToText,
  getTableTextLength,
} from "./schema";

import { NodeRendererRegistry } from "lumenpage-core";
import { paragraphRenderer } from "lumenpage-node-paragraph";
import { headingRenderer } from "lumenpage-node-heading";
import { tableRenderer } from "lumenpage-node-table";
import { bulletListRenderer, orderedListRenderer } from "lumenpage-node-list";
import { imageRenderer } from "lumenpage-node-image";

export const createDefaultNodeRendererRegistry = () => {
  const registry = new NodeRendererRegistry();
  registry.register("paragraph", paragraphRenderer);
  registry.register("heading", headingRenderer);
  registry.register("table", tableRenderer);
  registry.register("bullet_list", bulletListRenderer);
  registry.register("ordered_list", orderedListRenderer);
  registry.register("image", imageRenderer);
  return registry;
};

export {
  paragraphRenderer,
  headingRenderer,
  tableRenderer,
  bulletListRenderer,
  orderedListRenderer,
  imageRenderer,
};
