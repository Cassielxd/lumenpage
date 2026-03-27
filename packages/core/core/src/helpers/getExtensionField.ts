import type { AnyExtension } from "../types";

export const getExtensionField = <Value = any>(
  extension: AnyExtension | null | undefined,
  field: string,
  context: Record<string, any> = {}
): Value | undefined => {
  if (!extension) {
    return undefined;
  }

  const localValue = (extension.config as Record<string, any>)[field];
  const parentValue = extension.parent ? getExtensionField(extension.parent, field, context) : undefined;

  if (localValue === undefined) {
    return parentValue as Value | undefined;
  }

  if (typeof localValue !== "function") {
    return localValue as Value;
  }

  const bound = (...args: any[]) =>
    localValue.apply(
      {
        ...context,
        name: extension.name,
        parent: parentValue,
      },
      args
    );

  return bound as Value;
};
