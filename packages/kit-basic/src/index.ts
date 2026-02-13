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

export const createDefaultNodeRendererRegistry = () => {
  const registry = new NodeRendererRegistry();
  registry.register("paragraph", paragraphRenderer);
  registry.register("heading", headingRenderer);
  registry.register("table", tableRenderer);
  return registry;
};

export { paragraphRenderer, headingRenderer, tableRenderer };
