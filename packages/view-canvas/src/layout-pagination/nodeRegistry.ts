import type { CanvasNodeView } from "../view/nodeView";

/*
 * ļ˵ڵȾע
 * Ҫְ𣺰ڵͷַ layout/render ʵ֡
 */

export type NodeLayoutResult = {
  lines: any[];
  length: number;
  height?: number;
  blockAttrs?: any;
  blockLineHeight?: number;
  overflow?: NodeLayoutResult;
};

export type ContainerStyle = {
  indent?: number;
  [key: string]: any;
};

export type NodeRenderer = {
  toRuns?: (node: any, settings: any, registry?: any) => any;
  layoutBlock?: (ctx: any) => NodeLayoutResult;
  splitBlock?: (ctx: any) => NodeLayoutResult;
  allowSplit?: boolean;
  renderLine?: (ctx: any) => void;
  getContainerStyle?: (ctx: any) => ContainerStyle | null;
  renderContainer?: (ctx: any) => void;
  createNodeView?: (node: any, view: any, getPos: () => number) => CanvasNodeView;
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
