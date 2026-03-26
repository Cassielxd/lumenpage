import { selectNodeBackward as selectNodeBackwardCommand } from "lumenpage-commands";

import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    selectNodeBackward: {
      selectNodeBackward: () => ReturnType;
    };
  }
}

export const selectNodeBackward: RawCommands["selectNodeBackward"] =
  () =>
  ({ state, dispatch, view }) =>
    selectNodeBackwardCommand(state, dispatch, view ?? undefined);
