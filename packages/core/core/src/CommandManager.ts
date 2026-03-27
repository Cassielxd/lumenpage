import type { EditorState, Transaction } from "lumenpage-state";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import type { Editor } from "./Editor";
import { createChainableState } from "./helpers/createChainableState";
import type {
  AnyCommand,
  CanCommands,
  ChainedCommands,
  CommandMap,
  CommandProps,
  EditorCommand,
  LegacyCommand,
  SingleCommands,
} from "./types";

type CommandRuntime = {
  state?: EditorState | null;
  view?: CanvasEditorView | null;
  dispatch?: ((tr: Transaction) => void) | null;
};

type CommandExecutionContext = {
  state: EditorState;
  view: CanvasEditorView | null;
  tr: Transaction;
  shouldDispatch: boolean;
  finalDispatch: ((tr: Transaction) => void) | null;
};

export class CommandManager {
  readonly editor: Editor;
  readonly rawCommands: CommandMap;
  readonly runtime: CommandRuntime;

  constructor(editor: Editor, rawCommands: CommandMap, runtime: CommandRuntime = {}) {
    this.editor = editor;
    this.rawCommands = rawCommands;
    this.runtime = runtime;
  }

  get commands(): SingleCommands {
    return this.createCommandFacade(false) as SingleCommands;
  }

  chain(canOnly = false): ChainedCommands {
    return this.createChain(canOnly);
  }

  can(): CanCommands {
    return this.createCan();
  }

  withRuntime(runtime: CommandRuntime = {}) {
    return new CommandManager(this.editor, this.rawCommands, {
      ...this.runtime,
      ...runtime,
    });
  }

  private createCommandFacade(canOnly: boolean): SingleCommands | CanCommands {
    const commands = {} as Record<string, (...args: unknown[]) => boolean> & {
      run: (command: AnyCommand, ...args: unknown[]) => boolean;
      can: (name: string, ...args: unknown[]) => boolean;
      chain: () => ChainedCommands;
    };

    for (const [name, command] of Object.entries(this.rawCommands) as Array<[string, AnyCommand]>) {
      commands[name] = (...args: unknown[]) => {
        const context = this.createExecutionContext(canOnly);

        if (!context) {
          return false;
        }

        const handled = this.runResolvedCommand(command, args, context);
        this.dispatchContext(context);
        return handled;
      };
    }

    commands.run = (command: AnyCommand, ...args: unknown[]) => {
      const context = this.createExecutionContext(canOnly);

      if (!context) {
        return false;
      }

      const handled = this.runResolvedCommand(command, args, context);
      this.dispatchContext(context);
      return handled;
    };
    commands.can = (name: string, ...args: unknown[]) => {
      const context = this.createExecutionContext(true);

      if (!context) {
        return false;
      }

      return this.runResolvedCommand(this.rawCommands[name], args, context);
    };
    commands.chain = () => this.createChain(canOnly);

    return commands as unknown as SingleCommands | CanCommands;
  }

  private createCan(startTr?: Transaction): CanCommands {
    const sharedContext = startTr ? this.createExecutionContext(true, startTr) : null;
    const commands = {} as Record<string, (...args: unknown[]) => boolean> & {
      run: (command: AnyCommand, ...args: unknown[]) => boolean;
      can: (name: string, ...args: unknown[]) => boolean;
      chain: () => ChainedCommands;
    };

    for (const [name, command] of Object.entries(this.rawCommands) as Array<[string, AnyCommand]>) {
      commands[name] = (...args: unknown[]) => {
        const context = sharedContext ?? this.createExecutionContext(true, startTr);

        if (!context) {
          return false;
        }

        return this.runResolvedCommand(command, args, context);
      };
    }

    commands.run = (command: AnyCommand, ...args: unknown[]) => {
      const context = sharedContext ?? this.createExecutionContext(true, startTr);

      if (!context) {
        return false;
      }

      return this.runResolvedCommand(command, args, context);
    };
    commands.can = (name: string, ...args: unknown[]) => {
      const context = sharedContext ?? this.createExecutionContext(true, startTr);

      if (!context) {
        return false;
      }

      return this.runResolvedCommand(this.rawCommands[name], args, context);
    };
    commands.chain = () => this.createChain(true, sharedContext?.tr ?? startTr);

    return commands as unknown as CanCommands;
  }

  private createChain(
    canOnly: boolean,
    startTr?: Transaction,
    suppressFinalDispatch = false
  ): ChainedCommands {
    const callbacks: boolean[] = [];
    const context = this.createExecutionContext(canOnly, startTr, suppressFinalDispatch);
    const chain = {} as Record<string, (...args: unknown[]) => ChainedCommands> & {
      run: () => boolean;
      can: () => ChainedCommands;
    };

    for (const [name, command] of Object.entries(this.rawCommands) as Array<[string, AnyCommand]>) {
      chain[name] = (...args: unknown[]) => {
        callbacks.push(context ? this.runResolvedCommand(command, args, context) : false);
        return chain as unknown as ChainedCommands;
      };
    }

    chain.run = () => {
      if (context) {
        this.dispatchContext(context);
      }

      return callbacks.every((callback) => callback === true);
    };
    chain.can = () => this.createChain(true, context?.tr ?? startTr);

    return chain as unknown as ChainedCommands;
  }

  private createExecutionContext(
    canOnly: boolean,
    startTr?: Transaction,
    suppressFinalDispatch = false
  ): CommandExecutionContext | null {
    const state = this.getState();

    if (!state) {
      return null;
    }

    const shouldDispatch = this.shouldProvideDispatch(canOnly);

    return {
      state,
      view: this.getView(),
      tr: startTr ?? state.tr,
      shouldDispatch,
      finalDispatch: suppressFinalDispatch ? null : this.getFinalDispatch(shouldDispatch),
    };
  }

  private createCommandAccessor(context: CommandExecutionContext): SingleCommands {
    const commands = {} as Record<string, (...args: unknown[]) => boolean> & {
      run: (command: AnyCommand, ...args: unknown[]) => boolean;
      can: (name: string, ...args: unknown[]) => boolean;
      chain: () => ChainedCommands;
    };

    for (const [name, command] of Object.entries(this.rawCommands) as Array<[string, AnyCommand]>) {
      commands[name] = (...args: unknown[]) => this.runResolvedCommand(command, args, context);
    }

    commands.run = (command: AnyCommand, ...args: unknown[]) =>
      this.runResolvedCommand(command, args, context);
    commands.can = (name: string, ...args: unknown[]) => {
      const canContext = this.createExecutionContext(true, context.tr);

      if (!canContext) {
        return false;
      }

      return this.runResolvedCommand(this.rawCommands[name], args, canContext);
    };
    commands.chain = () => this.createChain(!context.shouldDispatch, context.tr, true);

    return commands as unknown as SingleCommands;
  }

  private buildProps(context: CommandExecutionContext): CommandProps {
    const props = {} as CommandProps;

    Object.assign(props, {
      editor: this.editor,
      tr: context.tr,
      state: createChainableState({
        state: context.state,
        transaction: context.tr,
      }),
      view: context.view,
      dispatch: context.shouldDispatch ? (() => undefined) : undefined,
      chain: () => this.createChain(!context.shouldDispatch, context.tr, true),
      can: () => this.createCan(context.tr),
    });

    Object.defineProperty(props, "commands", {
      configurable: true,
      enumerable: true,
      get: () => this.createCommandAccessor(context),
    });

    return props;
  }

  private shouldProvideDispatch(canOnly: boolean) {
    if (canOnly) {
      return false;
    }

    if (this.runtime.dispatch === null) {
      return false;
    }

    if (this.runtime.dispatch !== undefined) {
      return true;
    }

    if (this.runtime.state) {
      return true;
    }

    return !!(this.editor.view || this.editor.state);
  }

  private getFinalDispatch(shouldDispatch: boolean): ((tr: Transaction) => void) | null {
    if (!shouldDispatch) {
      return null;
    }

    if (this.runtime.dispatch !== undefined) {
      return this.runtime.dispatch;
    }

    if (this.runtime.state) {
      return null;
    }

    if (this.editor.view) {
      return this.editor.view.dispatch.bind(this.editor.view);
    }

    if (!this.editor.state) {
      return null;
    }

    return (tr: Transaction) => {
      this.editor.state = this.editor.state?.apply(tr) ?? null;
    };
  }

  private dispatchContext(context: CommandExecutionContext) {
    if (!context.shouldDispatch || !context.finalDispatch) {
      return;
    }

    if (context.tr.getMeta?.("preventDispatch")) {
      return;
    }

    context.finalDispatch(context.tr);
  }

  private getState(): EditorState | null {
    return (this.runtime.state || this.editor.view?.state || this.editor.state || null) as EditorState | null;
  }

  private getView(): CanvasEditorView | null {
    return (this.runtime.view ?? this.editor.view ?? null) as CanvasEditorView | null;
  }

  private runResolvedCommand(command: AnyCommand | undefined, args: unknown[], context: CommandExecutionContext) {
    if (typeof command !== "function") {
      return false;
    }

    if (args.length > 0) {
      return this.executeCommandResult((command as (...args: unknown[]) => unknown)(...args), context);
    }

    if (this.isLegacyCommand(command)) {
      return this.runLegacyCommand(command as LegacyCommand, context);
    }

    return this.executeCommandResult((command as () => unknown)(), context);
  }

  private executeCommandResult(result: unknown, context: CommandExecutionContext) {
    if (typeof result === "boolean") {
      return result;
    }

    if (typeof result !== "function") {
      return false;
    }

    if (this.isLegacyCommand(result)) {
      return this.runLegacyCommand(result as LegacyCommand, context);
    }

    return this.runEditorCommand(result as EditorCommand, context);
  }

  private isLegacyCommand(command: unknown): command is LegacyCommand {
    return typeof command === "function" && command.length >= 2;
  }

  private runLegacyCommand(command: LegacyCommand, context: CommandExecutionContext) {
    return command(
      createChainableState({
        state: context.state,
        transaction: context.tr,
      }),
      context.shouldDispatch ? (() => undefined) : undefined,
      context.view ?? undefined
    );
  }

  private runEditorCommand(command: EditorCommand, context: CommandExecutionContext) {
    return command(this.buildProps(context));
  }
}
