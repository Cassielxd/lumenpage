import type { MarkType, Schema } from "lumenpage-model";

export const getMarkType = (typeOrName: string | MarkType, schema: Schema) => {
  if (typeof typeOrName !== "string") {
    return typeOrName;
  }

  const type = schema.marks[typeOrName];

  if (!type) {
    throw new Error(`There is no mark type named "${typeOrName}".`);
  }

  return type;
};
