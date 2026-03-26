import type { MarkType } from "lumenpage-model";

import { getMarkType } from "../helpers/getMarkType";
import { isMarkActive } from "../helpers/isMarkActive";
import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    toggleMark: {
      toggleMark: (
        typeOrName: string | MarkType,
        attributes?: Record<string, unknown>,
        options?: {
          extendEmptyMarkRange?: boolean;
        }
      ) => ReturnType;
    };
  }
}

export const toggleMark: RawCommands["toggleMark"] = (
  typeOrName,
  attributes = {},
  options = {}
) => ({ state, commands }) => {
  const type = getMarkType(typeOrName, state.schema);

  if (isMarkActive(state, type, attributes)) {
    return commands.unsetMark(type, options);
  }

  return commands.setMark(type, attributes);
};
