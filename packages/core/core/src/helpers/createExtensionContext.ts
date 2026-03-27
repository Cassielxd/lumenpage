import type { NodeRendererRegistry } from "lumenpage-layout-engine";
import type { Schema } from "lumenpage-model";

import type { Editor } from "../Editor";
import type { ExtensionManager } from "../ExtensionManager";
import type { ExtensionContext, ExtensionStorage } from "../types";

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
