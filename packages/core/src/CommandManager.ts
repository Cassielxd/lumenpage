import type { Editor } from "./Editor";

export class CommandManager {
  readonly editor: Editor;
  readonly rawCommands: Record<string, any>;

  constructor(editor: Editor, rawCommands: Record<string, any>) {
    this.editor = editor;
    this.rawCommands = rawCommands;
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
    chain.can = () => this.chain(true);

    return chain;
  }

  can() {
    return this.createCommandFacade(true);
  }

  private createCommandFacade(canOnly: boolean) {
    const commands: Record<string, any> = {};
    for (const [name, command] of Object.entries(this.rawCommands)) {
      commands[name] = (...args: any[]) => this.runResolvedCommand(command, args, canOnly);
    }
    commands.run = (command: any, ...args: any[]) => this.runResolvedCommand(command, args, canOnly);
    commands.can = (name: string, ...args: any[]) =>
      this.runResolvedCommand(this.rawCommands[name], args, true);
    commands.chain = () => this.chain(canOnly);
    return commands;
  }

  private getDispatch(canOnly: boolean) {
    if (canOnly) {
      return null;
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

  private runResolvedCommand(command: any, args: any[], canOnly: boolean) {
    if (typeof command !== "function") {
      return false;
    }

    const dispatch = this.getDispatch(canOnly);
    const state = this.editor.view?.state || this.editor.state;
    const view = this.editor.view;
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
