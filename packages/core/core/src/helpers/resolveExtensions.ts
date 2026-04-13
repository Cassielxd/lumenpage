import { flattenExtensions } from "./flattenExtensions.js";
import { getExtensionField } from "./getExtensionField.js";
import { sortExtensions } from "./sortExtensions.js";
import type { AnyExtension, AnyExtensionInput, ExtensionContext } from "../types.js";

export const resolveExtensions = ({
  input,
  getContext,
}: {
  input: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput;
  getContext: (extension: AnyExtension) => ExtensionContext;
}): AnyExtension[] => {
  const resolveNestedExtensions = (extension: AnyExtension): AnyExtension[] => {
    const addExtensions = getExtensionField<() => ReadonlyArray<AnyExtensionInput>>(
      extension,
      "addExtensions",
      getContext(extension)
    );
    const nested = addExtensions?.() || [];

    return nested.length ? resolveMany(nested) : [];
  };

  const resolveMany = (value: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput): AnyExtension[] => {
    const resolved: AnyExtension[] = [];

    for (const extension of flattenExtensions(value)) {
      resolved.push(extension);

      const nested = resolveNestedExtensions(extension);

      if (nested.length) {
        resolved.push(...nested);
      }
    }

    return sortExtensions(resolved);
  };

  return resolveMany(input);
};
