import type { CommandProps, EditorCommand, RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    command: {
      command: (fn: (props: CommandProps) => boolean) => ReturnType;
    };
  }
}

export const command: RawCommands["command"] =
  (fn: (props: CommandProps) => boolean): EditorCommand =>
  (props) =>
    fn(props);
