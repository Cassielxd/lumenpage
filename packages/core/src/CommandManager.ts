import type { Editor } from "./Editor";

type CommandRuntime = {
  state?: any;
  view?: any;
  dispatch?: ((tr: any) => void) | null;
};

export class CommandManager {
  readonly editor: Editor;
  readonly rawCommands: Record<string, any>;
  readonly runtime: CommandRuntime;

  constructor(editor: Editor, rawCommands: Record<string, any>, runtime: CommandRuntime = {}) {
    this.editor = editor;
    this.rawCommands = rawCommands;
    this.runtime = runtime;
  }

  get commands() {
    return this.createCommandFacade(false);
  }

  chain(canOnly = false) {
    const queued: Array<() => boolean> = [];
    const chain: Record<string, any> = {};

    for (const [name, command] of Object.entries(this.rawCommands)) {
      chain[name] = (...args: any[]) => {
        queued.push(() => this.runResolvedCommand(command, args, canOnly));
        return chain;
      };
    }

    chain.run = () => queued.every((step) => step() === true);
    chain.can = () => this.withRuntime(this.runtime).chain(true);

    return chain;
  }

  can() {
    return this.createCommandFacade(true);
  }

  withRuntime(runtime: CommandRuntime = {}) {
    return new CommandManager(this.editor, this.rawCommands, {
      ...this.runtime,
      ...runtime,
    });
  }

  private createCommandFacade(canOnly: boolean) {
    const commands: Record<string, any> = {};
    for (const [name, command] of Object.entries(this.rawCommands)) {
      commands[name] = (...args: any[]) => this.runResolvedCommand(command, args, canOnly);
    }
    commands.run = (command: any, ...args: any[]) => this.runResolvedCommand(command, args, canOnly);
    commands.can = (name: string, ...args: any[]) =>
      this.runResolvedCommand(this.rawCommands[name], args, true);
    commands.chain = () => this.withRuntime(this.runtime).chain(canOnly);
    return commands;
  }

  private getDispatch(canOnly: boolean) {
    if (canOnly) {
      return null;
    }
    if (this.runtime.dispatch !== undefined) {
      return this.runtime.dispatch;
    }
    if (this.runtime.state) {
      return () => undefined;
    }
    if (this.editor.view) {
      return this.editor.view.dispatch.bind(this.editor.view);
    }
    if (!this.editor.state) {
      return null;
    }
    return (tr: any) => {
      this.editor.state = this.editor.state.apply(tr);
    };
  }

  private getState() {
    return this.runtime.state || this.editor.view?.state || this.editor.state;
  }

  private getView() {
    return this.runtime.view ?? this.editor.view ?? null;
  }

  private runResolvedCommand(command: any, args: any[], canOnly: boolean) {
    if (typeof command !== "function") {
      return false;
    }

    const dispatch = this.getDispatch(canOnly);
    const state = this.getState();
    const view = this.getView();
    if (!state) {
      return false;
    }

    if (args.length > 0) {
      const maybe = command(...args);
      if (typeof maybe === "function") {
        return maybe(state, dispatch, view);
      }
      if (typeof maybe === "boolean") {
        return maybe;
      }
    }

    if (command.length >= 2) {
      return command(state, dispatch, view);
    }

    const maybe = command();
    if (typeof maybe === "function") {
      return maybe(state, dispatch, view);
    }
    if (typeof maybe === "boolean") {
      return maybe;
    }
    return false;
  }
}
