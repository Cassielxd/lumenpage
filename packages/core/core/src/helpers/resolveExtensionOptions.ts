import { getExtensionField } from "./getExtensionField";
import { callOrReturn } from "../utilities/callOrReturn";
import type { AnyExtension } from "../types";

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
