import type { ResolvedStructure } from "../types.js";

export const createResolvedCanvas = (): ResolvedStructure["canvas"] => ({
  nodeViews: {},
  markAdapters: {},
  markAnnotationResolvers: {},
  selectionGeometries: [],
  nodeSelectionTypes: [],
  decorationProviders: [],
  hitTestPolicies: [],
});
