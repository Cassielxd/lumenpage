import { selectNodeForward as selectNodeForwardCommand } from "lumenpage-commands";

import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    selectNodeForward: {
      selectNodeForward: () => ReturnType;
    };
  }
}

export const selectNodeForward: RawCommands["selectNodeForward"] =
  () =>
  ({ state, dispatch, view }) =>
    selectNodeForwardCommand(state, dispatch, view ?? undefined);
