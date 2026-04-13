import { setBlockType } from "lumenpage-commands";
import type { NodeType } from "lumenpage-model";

import { getNodeType } from "../helpers/getNodeType.js";
import type { RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    setNode: {
      setNode: (
        typeOrName: string | NodeType,
        attributes?: Record<string, unknown>
      ) => ReturnType;
    };
  }
}

export const setNode: RawCommands["setNode"] = (typeOrName, attributes = {}) => ({
  state,
  dispatch,
}) => {
  const type = getNodeType(typeOrName, state.schema);
  const selection = state.selection as typeof state.selection & {
    $anchor: { sameParent: (head: unknown) => boolean; parent: { attrs?: Record<string, unknown> } };
    $head: unknown;
  };

  if (!type.isTextblock) {
    return false;
  }

  const attributesToCopy = selection.$anchor.sameParent(selection.$head)
    ? selection.$anchor.parent.attrs
    : undefined;

  return setBlockType(type, {
    ...(attributesToCopy || {}),
    ...attributes,
  })(state, dispatch);
};
