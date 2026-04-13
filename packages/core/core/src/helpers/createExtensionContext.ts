import type { NodeRendererRegistry } from "lumenpage-layout-engine";
import type { Schema } from "lumenpage-model";

import type { Editor } from "../Editor.js";
import type { ExtensionManager } from "../ExtensionManager.js";
import type { ExtensionContext, ExtensionStorage } from "../types.js";

export type ExtensionContextRuntime = {
  editor: Editor | null;
  manager: ExtensionManager;
  schema: Schema | null;
  nodeRegistry: NodeRendererRegistry | null;
};

export const createExtensionContext = ({
  name,
  options,
  storage,
  runtime,
}: {
  name: string;
  options: Record<string, unknown>;
  storage: ExtensionStorage;
  runtime: ExtensionContextRuntime;
}): ExtensionContext => ({
  name,
  options,
  storage,
  editor: runtime.editor,
  manager: runtime.manager,
  schema: runtime.schema,
  nodeRegistry: runtime.nodeRegistry,
});
