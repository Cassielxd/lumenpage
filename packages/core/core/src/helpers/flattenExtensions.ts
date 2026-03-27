import type { AnyExtension, AnyExtensionInput } from "../types";

export const flattenExtensions = (
  input: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput
): AnyExtension[] => {
  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenExtensions(item));
  }

  return input ? [input as AnyExtension] : [];
};
