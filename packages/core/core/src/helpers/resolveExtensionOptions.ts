import { getExtensionField } from "./getExtensionField.js";
import { callOrReturn } from "../utilities/callOrReturn.js";
import type { AnyExtension } from "../types.js";

export const resolveExtensionOptions = (extension: AnyExtension) => {
  const defaults = callOrReturn(
    getExtensionField<() => Record<string, unknown>>(extension, "addOptions", {
      name: extension.name,
    }),
    {}
  );

  return {
    ...defaults,
    ...(extension.options || {}),
  };
};
