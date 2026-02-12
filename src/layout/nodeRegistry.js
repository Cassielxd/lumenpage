/*
 * 文件说明：节点渲染注册表。
 * 主要职责：按节点类型分发 layout/render 实现。
 */

import { paragraphRenderer } from "../editor/node-renderers/paragraph.js";
import { headingRenderer } from "../editor/node-renderers/heading.js";
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

export { paragraphRenderer, headingRenderer, tableRenderer };

export const createDefaultNodeRendererRegistry = () => {
  const registry = new NodeRendererRegistry();
  registry.register("paragraph", paragraphRenderer);
  registry.register("heading", headingRenderer);
  registry.register("table", tableRenderer);
  return registry;
};
