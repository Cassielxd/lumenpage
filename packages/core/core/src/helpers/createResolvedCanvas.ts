import type { ResolvedStructure } from "../types";

export const createResolvedCanvas = (): ResolvedStructure["canvas"] => ({
  nodeViews: {},
  markAdapters: {},
  markAnnotationResolvers: {},
  selectionGeometries: [],
  nodeSelectionTypes: [],
  decorationProviders: [],
  hitTestPolicies: [],
});
