import type { ResolvedStructure } from "../types";

export const createResolvedSchema = (): ResolvedStructure["schema"] => ({
  nodes: {},
  marks: {},
});
