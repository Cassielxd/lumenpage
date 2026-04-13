import type { MarkAnnotationResolver, MarkRenderAdapter } from "./mark.js";

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

export type NodeLayoutContinuation = {
  fromPrev?: boolean;
  hasNext?: boolean;
  rowSplit?: boolean;
  continuationToken?: string | null;
  fragmentIdentity?: string | null;
  carryState?: Record<string, unknown> | null;
};

export type NodeLayoutResult = {
  lines: any[];
  length: number;
  height?: number;
  blockAttrs?: any;
  blockLineHeight?: number;
  continuation?: NodeLayoutContinuation;
  overflow?: NodeLayoutResult;
  fragments?: NodeLayoutSplitFragment[];
};

export type NodeLayoutSplitFragment = {
  kind?: "visible" | "overflow";
  lines: any[];
  length: number;
  height?: number;
  continuation?: NodeLayoutContinuation;
};

export type FragmentCursorPathSegment = string | number;

export type FragmentCursor = {
  nodeId: string | null;
  blockId?: string | null;
  startPos: number;
  endPos: number;
  path?: FragmentCursorPathSegment[];
  localCursor?: unknown;
  meta?: Record<string, unknown> | null;
};

export type MeasuredLayoutBreakpoint = {
  kind: string;
  startPos: number;
  endPos: number;
  cursor?: FragmentCursor | null;
  meta?: Record<string, unknown> | null;
};

export type MeasuredLayoutModel = {
  kind: string;
  nodeId: string | null;
  blockId?: string | null;
  startPos: number;
  endPos: number;
  width: number;
  height: number | null;
  children?: MeasuredLayoutModel[];
  breakpoints?: MeasuredLayoutBreakpoint[];
  meta?: Record<string, unknown> | null;
};

export type PaginatedSlice = {
  kind: string;
  nodeId: string | null;
  blockId?: string | null;
  startPos: number;
  endPos: number;
  fromPrev: boolean;
  hasNext: boolean;
  rowSplit?: boolean;
  boxes: LayoutBox[];
  fragments: LayoutFragment[];
  lines?: any[];
  nextCursor?: FragmentCursor | null;
  meta?: Record<string, unknown> | null;
};

export type PaginateBlockResult = {
  slice: PaginatedSlice;
  nextCursor?: FragmentCursor | null;
  exhausted?: boolean;
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

export type NodeRendererLayoutCapabilities = {
  toRuns?: (node: any, settings: any, registry?: any) => any;
  layoutBlock?: (ctx: any) => NodeLayoutResult;
  splitBlock?: (ctx: any) => NodeLayoutResult;
  measureBlock?: (ctx: any) => MeasuredLayoutModel | null;
  paginateBlock?: (ctx: any) => PaginateBlockResult | null;
  allowSplit?: boolean;
  pagination?: NodeRendererPaginationConfig;
  cacheLayout?: boolean;
  getCacheSignature?: (ctx: {
    node: any;
    settings: any;
    registry?: any;
    indent?: number;
  }) => unknown;
  getBlockSpacing?: (ctx: any) => NodeRendererBlockSpacing | null;
};

export type NodeRendererRenderCapabilities = {
  renderFragment?: (ctx: any) => void;
  renderSlice?: (ctx: any) => void;
  getContainerStyle?: (ctx: any) => ContainerStyle | null;
};

export type NodeRendererCompatCapabilities = {
  lineBodyMode?: "default-text" | "custom";
  listMarkerRenderMode?: "fragment" | "line-body";
  renderLine?: (ctx: any) => void;
  containerRenderMode?: "fragment" | "line-body";
  renderContainer?: (ctx: any) => void;
};

export type NodeRendererViewCapabilities = {
  createNodeView?: (node: any, view: any, getPos: () => number) => CanvasNodeViewLike;
};

export type NodeRenderer = NodeRendererLayoutCapabilities &
  NodeRendererRenderCapabilities &
  NodeRendererCompatCapabilities &
  NodeRendererViewCapabilities & {
    layout?: NodeRendererLayoutCapabilities | null;
    render?: (NodeRendererRenderCapabilities & { compat?: NodeRendererCompatCapabilities | null }) | null;
    compat?: NodeRendererCompatCapabilities | null;
    view?: NodeRendererViewCapabilities | null;
  };

const hasOwn = (value: unknown, key: string) =>
  !!value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);

const readScopedCapability = (renderer: any, scope: "layout" | "render" | "view", key: string) => {
  if (hasOwn(renderer?.[scope], key)) {
    return renderer[scope][key];
  }
  return renderer?.[key];
};

const readCompatCapability = (renderer: any, key: string) => {
  if (hasOwn(renderer?.render?.compat, key)) {
    return renderer.render.compat[key];
  }
  if (hasOwn(renderer?.compat, key)) {
    return renderer.compat[key];
  }
  if (hasOwn(renderer?.render, key)) {
    return renderer.render[key];
  }
  return renderer?.[key];
};

const buildCapabilityGroup = (
  renderer: any,
  keys: string[],
  reader: (renderer: any, key: string) => unknown
) => {
  const group: Record<string, unknown> = {};
  for (const key of keys) {
    const value = reader(renderer, key);
    if (value !== undefined) {
      group[key] = value;
    }
  }
  return group;
};

const mergeCapabilityGroup = (
  base: Record<string, unknown>,
  override: Record<string, unknown>
) => {
  const merged = { ...base, ...override };
  return Object.keys(merged).length > 0 ? merged : undefined;
};

const LAYOUT_CAPABILITY_KEYS = [
  "toRuns",
  "layoutBlock",
  "splitBlock",
  "measureBlock",
  "paginateBlock",
  "allowSplit",
  "pagination",
  "cacheLayout",
  "getCacheSignature",
  "getBlockSpacing",
];

const RENDER_CAPABILITY_KEYS = [
  "renderFragment",
  "renderSlice",
  "getContainerStyle",
];

const COMPAT_CAPABILITY_KEYS = [
  "lineBodyMode",
  "listMarkerRenderMode",
  "renderLine",
  "containerRenderMode",
  "renderContainer",
];

const VIEW_CAPABILITY_KEYS = ["createNodeView"];

export const resolveNodeRendererLayoutCapabilities = (
  renderer: NodeRenderer | null | undefined
): NodeRendererLayoutCapabilities =>
  buildCapabilityGroup(renderer, LAYOUT_CAPABILITY_KEYS, (target, key) =>
    readScopedCapability(target, "layout", key)
  ) as NodeRendererLayoutCapabilities;

export const resolveNodeRendererRenderCapabilities = (
  renderer: NodeRenderer | null | undefined
): NodeRendererRenderCapabilities =>
  buildCapabilityGroup(renderer, RENDER_CAPABILITY_KEYS, (target, key) =>
    readScopedCapability(target, "render", key)
  ) as NodeRendererRenderCapabilities;

export const resolveNodeRendererCompatCapabilities = (
  renderer: NodeRenderer | null | undefined
): NodeRendererCompatCapabilities =>
  buildCapabilityGroup(renderer, COMPAT_CAPABILITY_KEYS, readCompatCapability) as NodeRendererCompatCapabilities;

export const resolveNodeRendererViewCapabilities = (
  renderer: NodeRenderer | null | undefined
): NodeRendererViewCapabilities =>
  buildCapabilityGroup(renderer, VIEW_CAPABILITY_KEYS, (target, key) =>
    readScopedCapability(target, "view", key)
  ) as NodeRendererViewCapabilities;

export const mergeNodeRenderers = (
  baseRenderer: NodeRenderer | null | undefined,
  overrideRenderer: NodeRenderer | null | undefined
): NodeRenderer => {
  const merged = {
    ...(baseRenderer || {}),
    ...(overrideRenderer || {}),
  } as NodeRenderer;

  const layout = mergeCapabilityGroup(
    resolveNodeRendererLayoutCapabilities(baseRenderer),
    resolveNodeRendererLayoutCapabilities(overrideRenderer)
  );
  const render = mergeCapabilityGroup(
    resolveNodeRendererRenderCapabilities(baseRenderer),
    resolveNodeRendererRenderCapabilities(overrideRenderer)
  );
  const compat = mergeCapabilityGroup(
    resolveNodeRendererCompatCapabilities(baseRenderer),
    resolveNodeRendererCompatCapabilities(overrideRenderer)
  );
  const view = mergeCapabilityGroup(
    resolveNodeRendererViewCapabilities(baseRenderer),
    resolveNodeRendererViewCapabilities(overrideRenderer)
  );

  if (layout) {
    merged.layout = layout as NodeRendererLayoutCapabilities;
    Object.assign(merged, layout);
  }
  if (render || compat) {
    merged.render = {
      ...(render || {}),
      ...(compat ? { compat: compat as NodeRendererCompatCapabilities } : null),
    } as NodeRendererRenderCapabilities & { compat?: NodeRendererCompatCapabilities | null };
  }
  if (render) {
    Object.assign(merged, render);
  }
  if (compat) {
    merged.compat = compat as NodeRendererCompatCapabilities;
    Object.assign(merged, compat);
  }
  if (view) {
    merged.view = view as NodeRendererViewCapabilities;
    Object.assign(merged, view);
  }

  return merged;
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
