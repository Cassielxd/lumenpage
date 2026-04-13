import type { CanvasHooks, ResolvedStructure } from "../types.js";

export const applyCanvasHooks = (
  target: ResolvedStructure["canvas"],
  canvasHooks: CanvasHooks
) => {
  if (canvasHooks.nodeViews) {
    target.nodeViews = {
      ...target.nodeViews,
      ...canvasHooks.nodeViews,
    };
  }

  if (canvasHooks.selectionGeometries?.length) {
    target.selectionGeometries.push(...canvasHooks.selectionGeometries);
  }

  if (canvasHooks.nodeSelectionTypes?.length) {
    target.nodeSelectionTypes.push(...canvasHooks.nodeSelectionTypes);
  }

  if (canvasHooks.decorationProviders?.length) {
    target.decorationProviders.push(...canvasHooks.decorationProviders);
  }

  if (canvasHooks.hitTestPolicies?.length) {
    target.hitTestPolicies.push(...canvasHooks.hitTestPolicies);
  }
};
