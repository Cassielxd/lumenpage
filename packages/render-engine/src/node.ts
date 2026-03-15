import type { MarkRenderAdapter } from "./mark";
import type { MarkAnnotationResolver } from "./mark";

type CanvasNodeViewLike = any;

export type LayoutFragmentOwner = {
  key: string;
  type: string;
  role?: string;
  nodeId?: string | null;
  blockId?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  start?: number | null;
  end?: number | null;
  anchorOffset?: number | null;
  fixedBounds?: boolean;
  meta?: Record<string, unknown> | null;
};

export type LayoutBox = {
  key: string;
  type: string;
  role?: string;
  nodeId?: string | null;
  blockId?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  start?: number | null;
  end?: number | null;
  anchorOffset?: number | null;
  fixedBounds?: boolean;
  meta?: Record<string, unknown> | null;
  children?: LayoutBox[];
};

export type LayoutFragment = {
  key: string;
  type: string;
  role?: string;
  nodeId?: string | null;
  blockId?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  start?: number | null;
  end?: number | null;
  fixedBounds?: boolean;
  meta?: Record<string, unknown> | null;
  children?: LayoutFragment[];
};

export type NodeLayoutResult = {
  lines: any[];
  length: number;
  height?: number;
  blockAttrs?: any;
  blockLineHeight?: number;
  continuation?: {
    fromPrev?: boolean;
    hasNext?: boolean;
    rowSplit?: boolean;
  };
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

export type NodeRendererPaginationConfig = {
  fragmentModel?: "none" | "continuation";
  reusePolicy?: "actual-slice-only" | "always-sensitive";
};

export type NodeRendererBlockSpacing = {
  before?: number;
  after?: number;
};

export type NodeRenderer = {
  toRuns?: (node: any, settings: any, registry?: any) => any;
  layoutBlock?: (ctx: any) => NodeLayoutResult;
  splitBlock?: (ctx: any) => NodeLayoutResult;
  allowSplit?: boolean;
  pagination?: NodeRendererPaginationConfig;
  lineBodyMode?: "default-text" | "custom";
  cacheLayout?: boolean;
  getCacheSignature?: (ctx: {
    node: any;
    settings: any;
    registry?: any;
    indent?: number;
  }) => unknown;
  getBlockSpacing?: (ctx: any) => NodeRendererBlockSpacing | null;
  renderLine?: (ctx: any) => void;
  renderFragment?: (ctx: any) => void;
  getContainerStyle?: (ctx: any) => ContainerStyle | null;
  renderContainer?: (ctx: any) => void;
  createNodeView?: (node: any, view: any, getPos: () => number) => CanvasNodeViewLike;
};

export class NodeRendererRegistry {
  renderers;
  markAdapters;
  markAnnotationResolvers;

  constructor() {
    this.renderers = new Map();
    this.markAdapters = new Map();
    this.markAnnotationResolvers = new Map();
  }

  register(typeName, renderer) {
    this.renderers.set(typeName, renderer);

    return this;
  }

  registerMarkAdapter(typeName, adapter: MarkRenderAdapter) {
    this.markAdapters.set(typeName, adapter);

    return this;
  }

  registerMarkAnnotationResolver(typeName, resolver: MarkAnnotationResolver) {
    this.markAnnotationResolvers.set(typeName, resolver);

    return this;
  }

  get(typeName) {
    return this.renderers.get(typeName);
  }

  getMarkAdapter(typeName) {
    return this.markAdapters.get(typeName);
  }

  getMarkAnnotationResolver(typeName) {
    return this.markAnnotationResolvers.get(typeName);
  }

  has(typeName) {
    return this.renderers.has(typeName);
  }
}
