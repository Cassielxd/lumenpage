type CompatSelectionGeometry = {
  shouldComputeSelectionRects?: (ctx: any) => boolean;
  shouldRenderBorderOnly?: (ctx: any) => boolean;
};

type CompatResolvedExtensions = {
  canvas: {
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
