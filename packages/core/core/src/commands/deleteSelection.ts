import { deleteSelection as deleteSelectionCommand } from "lumenpage-commands";

import type { RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    deleteSelection: {
      deleteSelection: () => ReturnType;
    };
  }
}

export const deleteSelection: RawCommands["deleteSelection"] =
  () =>
  ({ state, dispatch, view }) =>
    deleteSelectionCommand(state, dispatch, view ?? undefined);
