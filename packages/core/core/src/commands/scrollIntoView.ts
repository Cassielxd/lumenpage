import type { EditorCommand, RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    scrollIntoView: {
      scrollIntoView: () => ReturnType;
    };
  }
}

export const scrollIntoView: RawCommands["scrollIntoView"] = (): EditorCommand => ({ tr }) => {
  tr.scrollIntoView();
  return true;
};
