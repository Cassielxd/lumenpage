import { Schema } from "lumenpage-model";

import type { LumenResolvedExtensions, LumenResolvedStructure } from "./types";

export const createLumenSchema = (resolved: LumenResolvedStructure | LumenResolvedExtensions) =>
  new Schema({
    nodes: resolved.schema.nodes,
    marks: resolved.schema.marks,
  });
