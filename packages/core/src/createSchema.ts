import { Schema } from "lumenpage-model";

import type { ResolvedExtensions, ResolvedStructure } from "./types";

export const createSchema = (resolved: ResolvedStructure | ResolvedExtensions) =>
  new Schema({
    nodes: resolved.schema.nodes,
    marks: resolved.schema.marks,
  });
