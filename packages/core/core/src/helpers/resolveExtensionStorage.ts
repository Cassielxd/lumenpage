import { getExtensionField } from "./getExtensionField";
import { callOrReturn } from "../utilities/callOrReturn";
import type { AnyExtension, ExtensionStorage } from "../types";
import type { ExtensionContextRuntime } from "./createExtensionContext";

export const resolveExtensionStorage = ({
  extension,
  options,
  runtime,
}: {
  extension: AnyExtension;
  options: Record<string, unknown>;
  runtime: ExtensionContextRuntime;
}): ExtensionStorage => {
  const storage = callOrReturn(
    getExtensionField<() => ExtensionStorage>(extension, "addStorage", {
      name: extension.name,
      options,
      editor: runtime.editor,
      manager: runtime.manager,
      schema: runtime.schema,
      nodeRegistry: runtime.nodeRegistry,
    }),
    {}
  );

  return storage ?? {};
};
