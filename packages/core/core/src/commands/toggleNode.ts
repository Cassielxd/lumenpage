import type { NodeType } from "lumenpage-model";

import { getNodeType } from "../helpers/getNodeType";
import { isNodeActive } from "../helpers/isNodeActive";
import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    toggleNode: {
      toggleNode: (
        typeOrName: string | NodeType,
        toggleTypeOrName: string | NodeType,
        attributes?: Record<string, unknown>
      ) => ReturnType;
    };
  }
}

export const toggleNode: RawCommands["toggleNode"] = (
  typeOrName,
  toggleTypeOrName,
  attributes = {}
) => ({ state, commands }) => {
  const type = getNodeType(typeOrName, state.schema);
  const toggleType = getNodeType(toggleTypeOrName, state.schema);
  const selection = state.selection as typeof state.selection & {
    $anchor: { sameParent: (head: unknown) => boolean; parent: { attrs?: Record<string, unknown> } };
    $head: unknown;
  };

  const attributesToCopy = selection.$anchor.sameParent(selection.$head)
    ? selection.$anchor.parent.attrs
    : undefined;

  if (isNodeActive(state, type, attributes)) {
    return commands.setNode(toggleType, attributesToCopy);
  }

  return commands.setNode(type, {
    ...(attributesToCopy || {}),
    ...attributes,
  });
};
