import { selectAll as selectAllCommand } from "lumenpage-commands";

import type { RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    selectAll: {
      selectAll: () => ReturnType;
    };
  }
}

export const selectAll: RawCommands["selectAll"] =
  () =>
  ({ state, dispatch, view }) =>
    selectAllCommand(state, dispatch, view ?? undefined);
