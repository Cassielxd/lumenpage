type AttributeMap = Record<string, unknown>;

export const mergeAttributes = (
  ...attributeSets: Array<AttributeMap | null | undefined>
): AttributeMap => {
  const merged: AttributeMap = {};

  for (const attributes of attributeSets) {
    if (!attributes) {
      continue;
    }

    for (const [key, value] of Object.entries(attributes)) {
      if (key === "style" && merged.style && value) {
        merged.style = `${String(merged.style)};${String(value)}`;
        continue;
      }

      merged[key] = value;
    }
  }

  return merged;
};
