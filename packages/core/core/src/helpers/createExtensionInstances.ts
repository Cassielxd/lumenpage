import { resolveExtensionOptions } from "./resolveExtensionOptions.js";
import { resolveExtensionStorage } from "./resolveExtensionStorage.js";
import { sortExtensions } from "./sortExtensions.js";
import type { AnyExtension, ExtensionInstance } from "../types.js";
import type { ExtensionContextRuntime } from "./createExtensionContext.js";

export const createExtensionInstances = ({
  extensions,
  runtime,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  runtime: ExtensionContextRuntime;
}): ExtensionInstance[] => {
  const seenNames = new Set<string>();
  const instances: ExtensionInstance[] = [];

  for (const extension of extensions) {
    const name = String(extension.name || "").trim();

    if (!name) {
      throw new Error("Extension name is required.");
    }

    if (seenNames.has(name)) {
      throw new Error(`Duplicate extension name: ${name}`);
    }

    seenNames.add(name);

    const options = resolveExtensionOptions(extension);
    const storage = resolveExtensionStorage({
      extension,
      options,
      runtime,
    });

    instances.push({
      name,
      type: extension.type,
      priority: extension.priority,
      options,
      storage,
      extension,
    });
  }

  return sortExtensions(instances);
};
