import type { CommandProps, EditorCommand, LegacyCommand, RawCommands } from "../types";

type FirstCommandItem = LegacyCommand | EditorCommand | ((props: CommandProps) => boolean);

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    first: {
      first: (
        commands: FirstCommandItem[] | ((props: CommandProps) => FirstCommandItem[])
      ) => ReturnType;
    };
  }
}

const runCommandItem = (command: FirstCommandItem, props: CommandProps) => {
  if (command.length >= 2) {
    return (command as LegacyCommand)(props.state, props.dispatch, props.view ?? undefined);
  }

  return (command as (props: CommandProps) => boolean)(props);
};

export const first: RawCommands["first"] = (
  commands: FirstCommandItem[] | ((props: CommandProps) => FirstCommandItem[])
) =>
  (props: CommandProps) => {
    const items = typeof commands === "function" ? commands(props) : commands;

    for (const item of items) {
      if (runCommandItem(item, props)) {
        return true;
      }
    }

    return false;
  };
