import type { AnyExtension, EnableRules } from "../types";

export const isExtensionRulesEnabled = (
  extension: AnyExtension,
  enabled: EnableRules | undefined
) => {
  if (Array.isArray(enabled)) {
    return enabled.some((entry) => {
      const name = typeof entry === "string" ? entry : entry?.name;
      return name === extension.name;
    });
  }

  return enabled !== false;
};
