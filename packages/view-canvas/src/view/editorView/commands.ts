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

  const runViewCommand = (cmd, args) => {
    if (typeof cmd !== "function") {
      return false;
    }
    if (args.length > 0) {
      const maybe = cmd(...args);
      if (typeof maybe === "function") {
        return runCommand(maybe, view.state, view.dispatch.bind(view), view);
      }
      if (typeof maybe === "boolean") {
        return maybe;
      }
    }
    if (cmd.length >= 2) {
      return runCommand(cmd, view.state, view.dispatch.bind(view), view);
    }
    const maybe = cmd();
    if (typeof maybe === "function") {
      return runCommand(maybe, view.state, view.dispatch.bind(view), view);
    }
    if (typeof maybe === "boolean") {
      return maybe;
    }
    return false;
  };

  const commands: Record<string, any> = {};
  for (const [name, cmd] of Object.entries(commandMap)) {
    commands[name] = (...args) => runViewCommand(cmd, args);
  }
  commands.run = (cmd, ...args) => runViewCommand(cmd, args);
  return commands;
};
