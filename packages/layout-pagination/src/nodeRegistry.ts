/*
 * 文件说明：节点渲染注册表。
 * 主要职责：按节点类型分发 layout/render 实现。
 */

export type NodeLayoutResult = {
  lines: any[];
  length: number;
  height?: number;
  blockAttrs?: any;
  blockLineHeight?: number;
  overflow?: NodeLayoutResult;
};

export type NodeRenderer = {
  toRuns?: (node: any, settings: any, registry?: any) => any;
  layoutBlock?: (ctx: any) => NodeLayoutResult;
  splitBlock?: (ctx: any) => NodeLayoutResult;
  allowSplit?: boolean;
  renderLine?: (ctx: any) => void;
};

export class NodeRendererRegistry {
  renderers;

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
