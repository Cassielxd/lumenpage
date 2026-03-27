import { resolveExtensionOptions } from "./resolveExtensionOptions";
import { resolveExtensionStorage } from "./resolveExtensionStorage";
import { sortExtensions } from "./sortExtensions";
import type { AnyExtension, ExtensionInstance } from "../types";
import type { ExtensionContextRuntime } from "./createExtensionContext";

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
