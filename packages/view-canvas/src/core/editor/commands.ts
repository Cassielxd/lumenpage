import { Command } from "lumenpage-state";

const noopCommand: Command = () => false;

export const createBasicCommands = (overrides: Partial<Record<string, Command>> = {}) => ({
  deleteSelection: overrides.deleteSelection ?? noopCommand,
  joinBackward: overrides.joinBackward ?? noopCommand,
  joinForward: overrides.joinForward ?? noopCommand,
  splitBlock: overrides.splitBlock ?? noopCommand,
  undo: overrides.undo ?? noopCommand,
  redo: overrides.redo ?? noopCommand,
});

export const runCommand = (command, state, dispatch) => {
  if (typeof command !== "function") {
    return false;
  }
  return command(state, dispatch);
};
