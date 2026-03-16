import { warnLegacyCanvasConfigUsage } from "../legacyConfigWarnings";
import type { CanvasCommands } from "../types";

export const resolveCommandConfiguration = ({
  resolveCanvasConfig,
  commandsFromProps,
}: {
  resolveCanvasConfig: (key: string, fallback?: any) => any;
  commandsFromProps?: CanvasCommands | null;
}) => {
  const strictLegacy = resolveCanvasConfig("legacyPolicy", null)?.strict === true;
  const legacyCommands = resolveCanvasConfig("commands", {});
  const hasPropCommands = commandsFromProps && typeof commandsFromProps === "object";
  const commands = hasPropCommands ? commandsFromProps : legacyCommands;
  if (!hasPropCommands && legacyCommands && Object.keys(legacyCommands).length > 0) {
    warnLegacyCanvasConfigUsage(
      "commands",
      "EditorProps.handleKeyDown + keymap plugin + explicit commands wiring",
      strictLegacy
    );
  }

  const noopCommand = () => false;
  const runCommand =
    commands.runCommand ??
    ((command: any, state: any, dispatch: any) =>
      (typeof command === "function" ? command(state, dispatch) : false));
  const basicCommands = {
    deleteSelection: commands.basicCommands?.deleteSelection ?? noopCommand,
    joinBackward: commands.basicCommands?.joinBackward ?? noopCommand,
    selectNodeBackward: commands.basicCommands?.selectNodeBackward ?? noopCommand,
    joinForward: commands.basicCommands?.joinForward ?? noopCommand,
    selectNodeForward: commands.basicCommands?.selectNodeForward ?? noopCommand,
    splitBlock: commands.basicCommands?.splitBlock ?? noopCommand,
    enter: commands.basicCommands?.enter ?? noopCommand,
    undo: commands.basicCommands?.undo ?? noopCommand,
    redo: commands.basicCommands?.redo ?? noopCommand,
  };
  const setBlockAlign = commands.setBlockAlign ?? (() => noopCommand);
  const keymap = commands.keymap ?? null;
  const enableBuiltInKeyFallback = commands.fallbackKeyHandling !== false;

  return {
    commands,
    runCommand,
    basicCommands,
    setBlockAlign,
    keymap,
    enableBuiltInKeyFallback,
  };
};
