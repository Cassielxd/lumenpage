import { paragraphRenderer } from "../editor/node-renderers/paragraph.js";
import { tableRenderer } from "../editor/node-renderers/table.js";

export class NodeRendererRegistry {
  constructor() {
    this.renderers = new Map();
  }

  register(typeName, renderer) {
    this.renderers.set(typeName, renderer);
    return this;
  }

  get(typeName) {
    return this.renderers.get(typeName);
  }

  has(typeName) {
    return this.renderers.has(typeName);
  }
}

export { paragraphRenderer, tableRenderer };

export const createDefaultNodeRendererRegistry = () => {
  const registry = new NodeRendererRegistry();
  registry.register("paragraph", paragraphRenderer);
  registry.register("table", tableRenderer);
  return registry;
};
