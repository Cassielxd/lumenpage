import type { RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    enter: {
      enter: () => ReturnType;
    };
  }
}

export const enter: RawCommands["enter"] =
  () =>
  ({ commands }) =>
    commands.first([
      () => commands.newlineInCode(),
      () => commands.createParagraphNear(),
      () => commands.liftEmptyBlock(),
      () => commands.splitBlock(),
    ]);
