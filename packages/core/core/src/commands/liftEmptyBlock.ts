import { liftEmptyBlock as liftEmptyBlockCommand } from "lumenpage-commands";

import type { RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    liftEmptyBlock: {
      liftEmptyBlock: () => ReturnType;
    };
  }
}

export const liftEmptyBlock: RawCommands["liftEmptyBlock"] =
  () =>
  ({ state, dispatch, view }) =>
    liftEmptyBlockCommand(state, dispatch, view ?? undefined);
