import type { MarkSpec, NodeSpec } from "lumenpage-model";

import type { ExtensionInstance, ResolvedStructure } from "../types";

export const applyExtensionSchema = ({
  target,
  instance,
  schemaSpec,
}: {
  target: ResolvedStructure["schema"];
  instance: ExtensionInstance;
  schemaSpec: NodeSpec | MarkSpec;
}) => {
  if (instance.type === "node") {
    if (instance.name in target.nodes) {
      throw new Error(`Duplicate schema node "${instance.name}" from extension "${instance.name}"`);
    }

    target.nodes[instance.name] = schemaSpec as NodeSpec;
    return;
  }

  if (instance.name in target.marks) {
    throw new Error(`Duplicate schema mark "${instance.name}" from extension "${instance.name}"`);
  }

  target.marks[instance.name] = schemaSpec as MarkSpec;
};
