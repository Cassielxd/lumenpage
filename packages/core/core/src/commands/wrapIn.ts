import { wrapIn as wrapInCommand } from "lumenpage-commands";
import type { NodeType } from "lumenpage-model";

import { getNodeType } from "../helpers/getNodeType";
import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    wrapIn: {
      wrapIn: (
        typeOrName: string | NodeType,
        attributes?: Record<string, unknown>
      ) => ReturnType;
    };
  }
}

export const wrapIn: RawCommands["wrapIn"] = (typeOrName, attributes = {}) => ({
  state,
  dispatch,
  view,
}) => {
  const type = getNodeType(typeOrName, state.schema);

  return wrapInCommand(type, attributes)(state, dispatch, view ?? undefined);
};
