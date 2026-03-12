import { NodeRendererRegistry, type NodeRenderer } from "./layout-pagination/index";
import { getDefaultNodeRenderer } from "./defaultRenderers/index";

type CompatSelectionGeometry = {
  shouldComputeSelectionRects?: (ctx: any) => boolean;
  shouldRenderBorderOnly?: (ctx: any) => boolean;
};

type CompatResolvedExtensions = {
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
    selectionGeometries: CompatSelectionGeometry[];
    nodeSelectionTypes: string[];
  };
};

const hasGeometryHandler = (
  geometry: CompatSelectionGeometry,
  key: "shouldComputeSelectionRects" | "shouldRenderBorderOnly",
  ctx: any
) => {
  const handler = geometry?.[key];
  return typeof handler === "function" ? handler(ctx) === true : false;
};

export const createLumenCompatSelectionGeometry = (resolved: CompatResolvedExtensions) => {
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

export const collectLumenNodeSelectionTypes = (resolved: CompatResolvedExtensions) =>
  Array.from(new Set(resolved.canvas.nodeSelectionTypes));

export const createLumenCompatNodeRegistry = (resolved: CompatResolvedExtensions) => {
  const registry = new NodeRendererRegistry();
  const layoutMap = resolved.layout?.byNodeName || new Map();
  const presetMap = resolved.layout?.renderPresetsByNodeName || new Map();
  const nodeViews = resolved.canvas?.nodeViews || {};
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

  return registry;
};
