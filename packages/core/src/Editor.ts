import { inputRules } from "lumenpage-inputrules";
import { keymap } from "lumenpage-keymap";
import { createLumenCompatNodeRegistry } from "lumenpage-layout-engine";
import {
  CanvasEditorView,
  collectLumenNodeSelectionTypes,
  createCanvasState,
  createLumenCompatSelectionGeometry,
  type CanvasCommandConfig,
  type CanvasEditorViewProps,
} from "lumenpage-view-canvas";

import { createLumenSchema } from "./createSchema";
import { LumenExtensionManager } from "./ExtensionManager";
import type {
  LumenExtensionInput,
  LumenResolvedExtensions,
  LumenResolvedStructure,
} from "./types";

type CreateStateOverrides = {
  doc?: any;
  json?: any;
  text?: string;
  plugins?: any[];
  createDocFromText?: ((text: string) => any) | null;
};

const BASIC_COMMAND_KEYS = [
  "deleteSelection",
  "joinBackward",
  "selectNodeBackward",
  "joinForward",
  "selectNodeForward",
  "splitBlock",
  "enter",
  "undo",
  "redo",
] as const;

export type LumenEditorStateFactoryContext = {
  editor: LumenEditor;
  schema: ReturnType<typeof createLumenSchema>;
  plugins: any[];
  createState: (overrides?: CreateStateOverrides) => any;
};

export type LumenEditorConfig = {
  extensions: ReadonlyArray<LumenExtensionInput> | LumenExtensionInput;
  element?: HTMLElement | null;
  state?: any | null;
  doc?: any;
  json?: any;
  text?: string;
  createDocFromText?: ((text: string) => any) | null;
  prependPlugins?: any[];
  appendPlugins?: any[];
  editorProps?: Partial<CanvasEditorViewProps>;
  canvasViewConfig?: Record<string, any> | null;
  commandConfig?: CanvasCommandConfig | null;
  stateFactory?: ((ctx: LumenEditorStateFactoryContext) => any) | null;
};

const hasSchemaSpec = (resolved: LumenResolvedStructure) =>
  Object.keys(resolved.schema.nodes).length > 0 || Object.keys(resolved.schema.marks).length > 0;

const createShortcutPlugins = (resolved: LumenResolvedExtensions) =>
  resolved.state.shortcuts
    .filter((shortcuts) => shortcuts && Object.keys(shortcuts).length > 0)
    .map((shortcuts) => keymap(shortcuts));

const createInputRulePlugins = (resolved: LumenResolvedExtensions) => {
  const rules = resolved.state.inputRules.filter(Boolean);
  return rules.length ? [inputRules({ rules })] : [];
};

export class LumenEditor {
  readonly options: LumenEditorConfig;
  readonly extensionManager: LumenExtensionManager;
  readonly schema: ReturnType<typeof createLumenSchema> | null;
  readonly nodeRegistry: any | null;
  readonly selectionGeometry: any;
  readonly nodeSelectionTypes: string[];
  readonly resolvedExtensions: LumenResolvedExtensions;
  readonly storage: Record<string, any>;
  readonly rawCommands: Record<string, any>;
  readonly commands: Record<string, any>;
  readonly plugins: any[];

  state: any | null;
  view: CanvasEditorView | null;

  constructor(config: LumenEditorConfig) {
    this.options = config;
    this.extensionManager = new LumenExtensionManager(config.extensions);

    const structure = this.extensionManager.resolveStructure(this);
    this.schema = hasSchemaSpec(structure) ? createLumenSchema(structure) : null;
    this.nodeRegistry = structure.layout.byNodeName.size
      ? createLumenCompatNodeRegistry(structure)
      : null;
    this.selectionGeometry = createLumenCompatSelectionGeometry(structure);
    this.nodeSelectionTypes = collectLumenNodeSelectionTypes(structure);

    const state = this.extensionManager.resolveState(structure, this);
    this.resolvedExtensions = {
      ...structure,
      state,
    };

    this.storage = Object.fromEntries(
      this.resolvedExtensions.instances.map((instance) => [instance.name, instance.storage])
    );
    this.rawCommands = this.resolvedExtensions.state.commands;
    this.plugins = this.buildPlugins();
    this.state = this.initializeState();
    this.commands = this.createCommandFacade(false);
    this.view = null;

    if (config.element) {
      this.mount(config.element);
    }
  }

  createState(overrides: CreateStateOverrides = {}) {
    if (!this.schema) {
      throw new Error("Cannot create editor state without a resolved schema.");
    }

    const state = createCanvasState({
      schema: this.schema,
      createDocFromText: overrides.createDocFromText ?? this.options.createDocFromText ?? undefined,
      doc: overrides.doc ?? this.options.doc ?? null,
      json: overrides.json ?? this.options.json ?? null,
      text: overrides.text ?? this.options.text ?? "",
      plugins: overrides.plugins ?? this.plugins,
    });

    return this.applyStateTransforms(state);
  }

  mount(element: HTMLElement) {
    if (!element) {
      throw new Error("Editor mount element is required.");
    }
    if (!this.state) {
      this.state = this.initializeState();
    }
    if (!this.state) {
      throw new Error("Editor state is not available. Pass state/doc/json/createDocFromText.");
    }
    if (this.view) {
      return this.view;
    }

    const editorProps = this.options.editorProps || {};
    const resolvedCanvasViewConfig = {
      ...(this.options.canvasViewConfig || {}),
      ...(editorProps.canvasViewConfig || {}),
      nodeRegistry:
        editorProps.canvasViewConfig?.nodeRegistry || this.options.canvasViewConfig?.nodeRegistry || this.nodeRegistry,
    };

    const viewProps: CanvasEditorViewProps = {
      ...editorProps,
      state: this.state,
      canvasViewConfig: resolvedCanvasViewConfig,
      commandConfig: this.createResolvedCommandConfig(
        this.options.commandConfig || editorProps.commandConfig || null
      ),
      selectionGeometry: editorProps.selectionGeometry || this.selectionGeometry || undefined,
      nodeSelectionTypes:
        editorProps.nodeSelectionTypes || (this.nodeSelectionTypes.length ? this.nodeSelectionTypes : undefined),
    };

    this.view = new CanvasEditorView(element, viewProps);
    return this.view;
  }

  destroy() {
    this.view?.destroy();
    this.view = null;
  }

  can() {
    return this.createCommandFacade(true);
  }

  private buildPlugins() {
    return [
      ...(this.options.prependPlugins || []),
      ...this.resolvedExtensions.state.plugins,
      ...createShortcutPlugins(this.resolvedExtensions),
      ...createInputRulePlugins(this.resolvedExtensions),
      ...(this.options.appendPlugins || []),
    ];
  }

  private initializeState() {
    if (this.options.state) {
      return this.options.state;
    }
    if (!this.schema) {
      return null;
    }

    const hasContentSource =
      this.options.doc != null ||
      this.options.json != null ||
      this.options.createDocFromText != null ||
      this.options.text != null;

    if (!hasContentSource && !this.options.stateFactory) {
      return null;
    }

    if (this.options.stateFactory) {
      return this.options.stateFactory({
        editor: this,
        schema: this.schema,
        plugins: this.plugins,
        createState: (overrides = {}) => this.createState(overrides),
      });
    }

    return this.createState();
  }

  private applyStateTransforms(state: any) {
    return this.resolvedExtensions.state.stateTransforms.reduce((currentState, transform) => {
      const nextState = transform(currentState);
      return nextState ?? currentState;
    }, state);
  }

  private createResolvedCommandConfig(override: CanvasCommandConfig | null) {
    const base = this.createDefaultCommandConfig();
    if (!override) {
      return base;
    }
    return {
      ...base,
      ...override,
      basicCommands: {
        ...(base.basicCommands || {}),
        ...(override.basicCommands || {}),
      },
      viewCommands: {
        ...(base.viewCommands || {}),
        ...(override.viewCommands || {}),
      },
    };
  }

  private createDefaultCommandConfig(): CanvasCommandConfig {
    const basicCommands = Object.fromEntries(
      BASIC_COMMAND_KEYS.map((key) => [key, this.rawCommands[key]]).filter(([, value]) => typeof value === "function")
    );
    return {
      basicCommands,
      viewCommands: this.rawCommands,
    };
  }

  private getDispatch(canOnly: boolean) {
    if (canOnly) {
      return null;
    }
    if (this.view) {
      return this.view.dispatch.bind(this.view);
    }
    if (!this.state) {
      return null;
    }
    return (tr: any) => {
      this.state = this.state.apply(tr);
    };
  }

  private runResolvedCommand(command: any, args: any[], canOnly: boolean) {
    if (typeof command !== "function") {
      return false;
    }

    const dispatch = this.getDispatch(canOnly);
    const state = this.view?.state || this.state;
    const view = this.view;
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

  private createCommandFacade(canOnly: boolean) {
    const commands: Record<string, any> = {};
    for (const [name, command] of Object.entries(this.rawCommands)) {
      commands[name] = (...args: any[]) => this.runResolvedCommand(command, args, canOnly);
    }
    commands.run = (command: any, ...args: any[]) => this.runResolvedCommand(command, args, canOnly);
    commands.can = (name: string, ...args: any[]) =>
      this.runResolvedCommand(this.rawCommands[name], args, true);
    return commands;
  }
}
