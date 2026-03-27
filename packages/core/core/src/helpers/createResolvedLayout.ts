import type { LayoutHooks, ResolvedStructure } from "../types";

export const createResolvedLayout = (): ResolvedStructure["layout"] => ({
  byNodeName: new Map<string, LayoutHooks>(),
  renderPresetsByNodeName: new Map<string, string>(),
});
