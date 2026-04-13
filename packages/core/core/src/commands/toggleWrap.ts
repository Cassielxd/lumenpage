import { lift } from "lumenpage-commands";
import type { NodeType } from "lumenpage-model";

import { getNodeType } from "../helpers/getNodeType.js";
import { isNodeActive } from "../helpers/isNodeActive.js";
import type { RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    toggleWrap: {
      toggleWrap: (
        typeOrName: string | NodeType,
        attributes?: Record<string, unknown>
      ) => ReturnType;
    };
  }
}

export const toggleWrap: RawCommands["toggleWrap"] = (typeOrName, attributes = {}) => ({
  state,
  dispatch,
  commands,
}) => {
  const type = getNodeType(typeOrName, state.schema);

  if (!isNodeActive(state, type, attributes)) {
    return commands.wrapIn(type, attributes);
  }

  return lift(state, dispatch);
};