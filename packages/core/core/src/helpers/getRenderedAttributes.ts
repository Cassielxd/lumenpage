import { mergeAttributes } from "../utilities/mergeAttributes.js";
import type { AttributeConfigs, HTMLAttributes, UnknownRecord } from "../types.js";

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const getRenderedAttributes = (
  attributeConfigs: AttributeConfigs | null,
  attrs: HTMLAttributes | null | undefined
): HTMLAttributes => {
  let htmlAttributes: HTMLAttributes = {};

  if (!attributeConfigs) {
    return htmlAttributes;
  }

  for (const [name, config] of Object.entries(attributeConfigs)) {
    if (typeof config?.renderHTML === "function") {
      const rendered = config.renderHTML(attrs || {});

      if (isRecord(rendered)) {
        htmlAttributes = mergeAttributes(htmlAttributes, rendered);
      }

      continue;
    }

    const value = attrs?.[name];

    if (value !== null && value !== undefined) {
      htmlAttributes[name] = value;
    }
  }

  return htmlAttributes;
};
