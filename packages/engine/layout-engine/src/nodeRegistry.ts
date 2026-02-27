type CanvasNodeViewLike = any;

/*
 * 节点渲染注册表：按节点类型挂载布局/渲染实现。
 */

export type NodeLayoutResult = {
  lines: any[];
  length: number;
  height?: number;
  blockAttrs?: any;
  blockLineHeight?: number;
  overflow?: NodeLayoutResult;
  fragments?: NodeLayoutSplitFragment[];
};

export type NodeLayoutSplitFragment = {
  kind?: "visible" | "overflow";
  lines: any[];
  length: number;
  height?: number;
  continuation?: {
    fromPrev?: boolean;
    hasNext?: boolean;
    rowSplit?: boolean;
  };
};

export type ContainerStyle = {
  indent?: number;
  [key: string]: any;
};

// 节点渲染接口：可覆盖 runs、分块布局与容器渲染。
export type NodeRenderer = {
  toRuns?: (node: any, settings: any, registry?: any) => any;
  layoutBlock?: (ctx: any) => NodeLayoutResult;
  splitBlock?: (ctx: any) => NodeLayoutResult;
  allowSplit?: boolean;
  cacheLayout?: boolean;
  getCacheSignature?: (ctx: {
    node: any;
    settings: any;
    registry?: any;
    indent?: number;
  }) => unknown;
  renderLine?: (ctx: any) => void;
  getContainerStyle?: (ctx: any) => ContainerStyle | null;
  renderContainer?: (ctx: any) => void;
  createNodeView?: (node: any, view: any, getPos: () => number) => CanvasNodeViewLike;
};

export class NodeRendererRegistry {
  renderers;

  // 初始化注册表。
  constructor() {
    this.renderers = new Map();
  }

  // 注册节点渲染器。
  register(typeName, renderer) {
    this.renderers.set(typeName, renderer);

    return this;
  }

  // 获取节点渲染器。
  get(typeName) {
    return this.renderers.get(typeName);
  }

  // 判断是否已注册。
  has(typeName) {
    return this.renderers.has(typeName);
  }
}
