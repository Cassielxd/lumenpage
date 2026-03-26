import { joinForward as joinForwardCommand } from "lumenpage-commands";

import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    joinForward: {
      joinForward: () => ReturnType;
    };
  }
}

export const joinForward: RawCommands["joinForward"] =
  () =>
  ({ state, dispatch, view }) =>
    joinForwardCommand(state, dispatch, view ?? undefined);
