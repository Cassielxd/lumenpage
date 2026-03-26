import { newlineInCode as newlineInCodeCommand } from "lumenpage-commands";

import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    newlineInCode: {
      newlineInCode: () => ReturnType;
    };
  }
}

export const newlineInCode: RawCommands["newlineInCode"] =
  () =>
  ({ state, dispatch, view }) =>
    newlineInCodeCommand(state, dispatch, view ?? undefined);
