import type { AttributeSpec } from "lumenpage-model";

import type { AttributeConfigs } from "../types.js";

export type AttributeSpecMap = Record<string, AttributeSpec>;

export const getAttributeSpecs = (attributeConfigs: AttributeConfigs | null): AttributeSpecMap | null => {
  if (!attributeConfigs || Object.keys(attributeConfigs).length === 0) {
    return null;
  }

  const attrs: AttributeSpecMap = {};

  for (const [name, config] of Object.entries(attributeConfigs)) {
    attrs[name] =
      config && Object.prototype.hasOwnProperty.call(config, "default")
        ? { default: config.default }
        : {};
  }

  return attrs;
};
