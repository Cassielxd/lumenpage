import { createNodeRegistry as createLayoutNodeRegistry } from "lumenpage-layout-engine";

type SelectionGeometry = {
  shouldComputeSelectionRects?: (ctx: any) => boolean;
  shouldRenderBorderOnly?: (ctx: any) => boolean;
  resolveSelectionRects?: (ctx: any) => any[] | null | undefined;
};

type ResolvedExtensionRuntime = {
  schema?: {
    nodes?: Record<string, any>;
  };
  layout: {
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
    resolveSelectionRects: (ctx: any) => {
      for (const geometry of geometries) {
        const handler = geometry?.resolveSelectionRects;
        if (typeof handler !== "function") {
          continue;
        }
        const rects = handler(ctx);
        if (Array.isArray(rects) && rects.length > 0) {
          return rects;
        }
      }
      return null;
    },
  });
};

export const collectNodeSelectionTypes = (resolved: ResolvedExtensionRuntime) =>
  Array.from(new Set(resolved.canvas.nodeSelectionTypes));

export const createNodeRegistry = (resolved: ResolvedExtensionRuntime) =>
  createLayoutNodeRegistry(resolved);
