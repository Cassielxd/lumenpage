import type { DOMOutputSpec } from "lumenpage-model";

import { mergeAttributes } from "../utilities/mergeAttributes";
import type { HTMLAttributes, UnknownRecord } from "../types";

const isPlainAttributesObject = (value: unknown): value is UnknownRecord =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof (value as { nodeType?: unknown }).nodeType !== "number";

export const injectRenderedAttributesToDOMOutput = (
  output: DOMOutputSpec,
  htmlAttributes: HTMLAttributes
): DOMOutputSpec => {
  if (!Array.isArray(output) || Object.keys(htmlAttributes).length === 0) {
    return output;
  }

  const [tag, maybeAttrs, ...rest] = output;

  if (isPlainAttributesObject(maybeAttrs)) {
    return [tag, mergeAttributes(maybeAttrs, htmlAttributes), ...rest];
  }

  const nextOutput: [string, ...unknown[]] = [tag, htmlAttributes];

  if (maybeAttrs !== undefined) {
    nextOutput.push(maybeAttrs);
  }

  nextOutput.push(...rest);
  return nextOutput;
};
