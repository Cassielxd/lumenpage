import type { ResolvedStructure } from "../types.js";

export const createResolvedSchema = (): ResolvedStructure["schema"] => ({
  nodes: {},
  marks: {},
});
