import type { CanvasSelectionGeometry, ResolvedStructure } from "../../types";

const hasGeometryHandler = (
  geometry: CanvasSelectionGeometry,
  key: "shouldComputeSelectionRects" | "shouldRenderBorderOnly",
  ctx: any
) => {
  const handler = geometry?.[key];
  return typeof handler === "function" ? handler(ctx) === true : false;
};

export const createSelectionGeometry = (resolved: ResolvedStructure) => {
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

export const collectNodeSelectionTypes = (resolved: ResolvedStructure) =>
  Array.from(new Set(resolved.canvas.nodeSelectionTypes));
