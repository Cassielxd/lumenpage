import { NodeRendererRegistry, type NodeRenderer } from "lumenpage-render-engine";
import { getDefaultNodeRenderer } from "./defaultRenderers/index";

type SelectionGeometry = {
  shouldComputeSelectionRects?: (ctx: any) => boolean;
  shouldRenderBorderOnly?: (ctx: any) => boolean;
};

type ResolvedExtensionRuntime = {
  schema?: {
    nodes?: Record<string, any>;
  };
  layout?: {
    byNodeName: Map<
      string,
      {
        renderer?: any;
        pagination?: unknown;
      }
    >;
    renderPresetsByNodeName?: Map<string, string>;
  };
  canvas: {
    nodeViews?: Record<string, any>;
    markAdapters?: Record<string, any>;
    markAnnotationResolvers?: Record<string, any>;
    selectionGeometries: SelectionGeometry[];
    nodeSelectionTypes: string[];
  };
};

const hasGeometryHandler = (
  geometry: SelectionGeometry,
  key: "shouldComputeSelectionRects" | "shouldRenderBorderOnly",
  ctx: any
) => {
  const handler = geometry?.[key];
  return typeof handler === "function" ? handler(ctx) === true : false;
};

export const createSelectionGeometry = (resolved: ResolvedExtensionRuntime) => {
  const geometries = resolved.canvas.selectionGeometries;
  if (!geometries.length) {
    return null;
  }

  return () => ({
    shouldComputeSelectionRects: (ctx: any) =>
      geometries.some((geometry) => hasGeometryHandler(geometry, "shouldComputeSelectionRects", ctx)),
    shouldRenderBorderOnly: (ctx: any) =>
      geometries.some((geometry) => hasGeometryHandler(geometry, "shouldRenderBorderOnly", ctx)),
  });
};

export const collectNodeSelectionTypes = (resolved: ResolvedExtensionRuntime) =>
  Array.from(new Set(resolved.canvas.nodeSelectionTypes));

export const createNodeRegistry = (resolved: ResolvedExtensionRuntime) => {
  const registry = new NodeRendererRegistry();
  const layoutMap = resolved.layout?.byNodeName || new Map();
  const presetMap = resolved.layout?.renderPresetsByNodeName || new Map();
  const nodeViews = resolved.canvas?.nodeViews || {};
  const markAdapters = resolved.canvas?.markAdapters || {};
  const markAnnotationResolvers = resolved.canvas?.markAnnotationResolvers || {};
  const nodeNames = new Set<string>([
    ...Object.keys(resolved.schema?.nodes || {}),
    ...layoutMap.keys(),
    ...presetMap.keys(),
    ...Object.keys(nodeViews),
  ]);

  for (const nodeName of nodeNames) {
    const preset = presetMap.get(nodeName) || nodeName;
    const defaultRenderer = getDefaultNodeRenderer(preset);
    const layoutHooks = layoutMap.get(nodeName);
    const explicitRenderer = (layoutHooks?.renderer || null) as (NodeRenderer & {
      pagination?: unknown;
    }) | null;
    const createNodeView =
      nodeViews[nodeName] || explicitRenderer?.createNodeView || defaultRenderer?.createNodeView;
    const mergedRenderer = {
      ...(defaultRenderer || {}),
      ...(explicitRenderer || {}),
      pagination:
        layoutHooks?.pagination || explicitRenderer?.pagination || defaultRenderer?.pagination,
      createNodeView,
    };

    if (!Object.values(mergedRenderer).some((value) => value != null)) {
      continue;
    }

    registry.register(nodeName, mergedRenderer);
  }

  for (const [markName, adapter] of Object.entries(markAdapters)) {
    if (adapter != null) {
      registry.registerMarkAdapter(markName, adapter);
    }
  }

  for (const [markName, resolver] of Object.entries(markAnnotationResolvers)) {
    if (resolver != null) {
      registry.registerMarkAnnotationResolver(markName, resolver);
    }
  }

  return registry;
};

