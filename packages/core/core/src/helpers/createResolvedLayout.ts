import type { LayoutHooks, ResolvedStructure } from "../types.js";

export const createResolvedLayout = (): ResolvedStructure["layout"] => ({
  byNodeName: new Map<string, LayoutHooks>(),
  renderPresetsByNodeName: new Map<string, string>(),
});
