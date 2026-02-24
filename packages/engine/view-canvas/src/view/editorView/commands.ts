// 解析 canvasConfig.commands.viewCommands 并挂载到 view.commands。
export const setupViewCommands = ({
  view,
  schema,
  basicCommands,
  setBlockAlign,
  viewCommandConfig,
  runCommand,
}) => {
  const resolvedViewCommands =
    typeof viewCommandConfig === "function"
      ? viewCommandConfig({ schema, basicCommands, setBlockAlign })
      : viewCommandConfig;

  const commandMap =
    resolvedViewCommands && typeof resolvedViewCommands === "object" ? resolvedViewCommands : {};

  const runViewCommand = (cmd, args, dispatch) => {
    if (typeof cmd !== "function") {
      return false;
    }
    if (args.length > 0) {
      const maybe = cmd(...args);
      if (typeof maybe === "function") {
        return runCommand(maybe, view.state, dispatch, view);
      }
      if (typeof maybe === "boolean") {
        return maybe;
      }
    }
    if (cmd.length >= 2) {
      return runCommand(cmd, view.state, dispatch, view);
    }
    const maybe = cmd();
    if (typeof maybe === "function") {
      return runCommand(maybe, view.state, dispatch, view);
    }
    if (typeof maybe === "boolean") {
      return maybe;
    }
    return false;
  };

  const commands: Record<string, any> = {};
  for (const [name, cmd] of Object.entries(commandMap)) {
    commands[name] = (...args) => runViewCommand(cmd, args, view.dispatch.bind(view));
  }
  commands.run = (cmd, ...args) => runViewCommand(cmd, args, view.dispatch.bind(view));
  commands.can = (name, ...args) => runViewCommand(commandMap?.[name], args, null);
  return commands;
};
