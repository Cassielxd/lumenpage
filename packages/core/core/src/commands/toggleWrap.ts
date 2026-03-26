import { lift } from "lumenpage-commands";
import type { NodeType } from "lumenpage-model";

import { getNodeType } from "../helpers/getNodeType";
import { isNodeActive } from "../helpers/isNodeActive";
import type { RawCommands } from "../types";

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