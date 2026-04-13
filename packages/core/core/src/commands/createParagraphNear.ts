import { createParagraphNear as createParagraphNearCommand } from "lumenpage-commands";

import type { RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    createParagraphNear: {
      createParagraphNear: () => ReturnType;
    };
  }
}

export const createParagraphNear: RawCommands["createParagraphNear"] =
  () =>
  ({ state, dispatch, view }) =>
    createParagraphNearCommand(state, dispatch, view ?? undefined);
