import type { NodeType, Schema } from "lumenpage-model";

export const getNodeType = (typeOrName: string | NodeType, schema: Schema) => {
  if (typeof typeOrName !== "string") {
    return typeOrName;
  }

  const type = schema.nodes[typeOrName];

  if (!type) {
    throw new Error(`There is no node type named "${typeOrName}".`);
  }

  return type;
};
