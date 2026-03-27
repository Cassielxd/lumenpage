import { getExtensionField } from "./getExtensionField";
import { createExtensionContext } from "./createExtensionContext";
import { callOrReturn } from "../utilities/callOrReturn";
import type { ExtensionInstance, GlobalAttributes } from "../types";
import type { ExtensionContextRuntime } from "./createExtensionContext";

export const resolveGlobalAttributes = ({
  instances,
  runtime,
}: {
  instances: ExtensionInstance[];
  runtime: ExtensionContextRuntime;
}): GlobalAttributes => {
  const resolved: GlobalAttributes = [];

  for (const instance of instances) {
    const ctx = createExtensionContext({
      name: instance.name,
      options: instance.options,
      storage: instance.storage,
      runtime,
    });
    const attributes = callOrReturn(
      getExtensionField<() => GlobalAttributes>(instance.extension, "addGlobalAttributes", ctx),
      []
    );

    if (Array.isArray(attributes) && attributes.length) {
      resolved.push(...attributes);
    }
  }

  return resolved;
};
