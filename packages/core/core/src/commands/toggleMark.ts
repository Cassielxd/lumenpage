import type { MarkType } from "lumenpage-model";

import { getMarkType } from "../helpers/getMarkType.js";
import { isMarkActive } from "../helpers/isMarkActive.js";
import type { RawCommands } from "../types.js";

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
