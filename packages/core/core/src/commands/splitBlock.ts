import { splitBlock as splitBlockCommand } from "lumenpage-commands";

import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    splitBlock: {
      splitBlock: () => ReturnType;
    };
  }
}

export const splitBlock: RawCommands["splitBlock"] =
  () =>
  ({ state, dispatch, view }) =>
    splitBlockCommand(state, dispatch, view ?? undefined);
