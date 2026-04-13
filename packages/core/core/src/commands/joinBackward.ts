import { joinBackward as joinBackwardCommand } from "lumenpage-commands";

import type { RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    joinBackward: {
      joinBackward: () => ReturnType;
    };
  }
}

export const joinBackward: RawCommands["joinBackward"] =
  () =>
  ({ state, dispatch, view }) =>
    joinBackwardCommand(state, dispatch, view ?? undefined);
