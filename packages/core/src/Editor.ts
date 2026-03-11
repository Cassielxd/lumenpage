import { inputRules } from "lumenpage-inputrules";
import { keymap } from "lumenpage-keymap";
import { createLumenCompatNodeRegistry } from "lumenpage-layout-engine";
import { EditorState, Selection } from "lumenpage-state";
import {
  CanvasEditorView,
  collectLumenNodeSelectionTypes,
  createLumenCompatSelectionGeometry,
  type CanvasCommandConfig,
  type CanvasEditorViewProps,
} from "lumenpage-view-canvas";

import { CommandManager } from "./CommandManager";
import { createDocument, type ContentParser } from "./createDocument";
import { createSchema } from "./createSchema";
import { ExtensionManager } from "./ExtensionManager";
import { pasteRulesPlugin } from "./PasteRule";
import type {
  AnyExtensionInput,
  EnableRules,
  ResolvedExtensions,
  ResolvedStructure,
} from "./types";

type CreateStateOptions = {
  content?: any;
  plugins?: any[];
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

export type EditorStateFactoryContext = {
  editor: Editor;
  schema: ReturnType<typeof createSchema>;
  plugins: any[];
  createState: (overrides?: CreateStateOptions) => any;
};

export type EditorOptions = {
  extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput;
  element?: HTMLElement | null;
  content?: any;
  state?: any | null;
  parseContent?: ContentParser | null;
  plugins?: any[];
  editorProps?: Partial<CanvasEditorViewProps>;
  canvas?: Record<string, any> | null;
  commandConfig?: CanvasCommandConfig | null;
  stateFactory?: ((ctx: EditorStateFactoryContext) => any) | null;
  enableInputRules?: EnableRules;
  enablePasteRules?: EnableRules;
  autofocus?: boolean | "start" | "end" | number;
  editable?: boolean;
  onBeforeCreate?: ((args: { editor: Editor }) => void) | null;
  onCreate?: ((args: { editor: Editor }) => void) | null;
  onDestroy?: (() => void) | null;
};

const defaultOptions: EditorOptions = {
  extensions: [],
  element: null,
  content: "",
  state: null,
  parseContent: null,
  plugins: [],
  editorProps: {},
  canvas: null,
  commandConfig: null,
  stateFactory: null,
  enableInputRules: true,
  enablePasteRules: true,
  autofocus: false,
  editable: true,
  onBeforeCreate: null,
  onCreate: null,
  onDestroy: null,
};

const hasSchemaSpec = (resolved: ResolvedStructure) =>
  Object.keys(resolved.schema.nodes).length > 0 || Object.keys(resolved.schema.marks).length > 0;

const createShortcutPlugins = (resolved: ResolvedExtensions) =>
  resolved.state.keyboardShortcuts
    .filter((shortcuts) => shortcuts && Object.keys(shortcuts).length > 0)
    .map((shortcuts) => keymap(shortcuts));

const createInputRulePlugins = (resolved: ResolvedExtensions) => {
  const rules = resolved.state.inputRules.filter(Boolean);
  return rules.length ? [inputRules({ rules })] : [];
};

const createPasteRulePlugins = (editor: Editor, resolved: ResolvedExtensions) => {
  const rules = resolved.state.pasteRules.filter(Boolean);
  return rules.length ? pasteRulesPlugin({ editor, rules }) : [];
};

export class Editor {
  options: EditorOptions;
  readonly extensionManager: ExtensionManager;
  readonly schema: ReturnType<typeof createSchema> | null;
  readonly nodeRegistry: any | null;
  readonly selectionGeometry: any;
  readonly nodeSelectionTypes: string[];
  readonly resolvedExtensions: ResolvedExtensions;
  readonly extensionStorage: Record<string, any>;
  readonly rawCommands: Record<string, any>;
  readonly plugins: any[];

  state: any | null;
  view: CanvasEditorView | null;

  private readonly commandManager: CommandManager;

  constructor(options: Partial<EditorOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
    this.extensionManager = new ExtensionManager(this.options.extensions, this);

    const structure = this.extensionManager.resolveStructure(this);
    this.schema = hasSchemaSpec(structure) ? createSchema(structure) : null;
    this.nodeRegistry = structure.layout.byNodeName.size
      ? createLumenCompatNodeRegistry(structure)
      : null;
    this.extensionManager.setRuntime({ schema: this.schema, nodeRegistry: this.nodeRegistry });

    this.selectionGeometry = createLumenCompatSelectionGeometry(structure);
    this.nodeSelectionTypes = collectLumenNodeSelectionTypes(structure);

    const state = this.extensionManager.resolveState(structure, this);
    this.resolvedExtensions = {
      ...structure,
      state,
    };

    this.extensionStorage = Object.fromEntries(
      this.resolvedExtensions.instances.map((instance) => [instance.name, instance.storage])
    );
    this.rawCommands = this.resolvedExtensions.state.commands;
    this.plugins = this.buildPlugins();
    this.state = this.initializeState();
    this.view = null;
    this.commandManager = new CommandManager(this, this.rawCommands);

    this.options.onBeforeCreate?.({ editor: this });

    if (this.options.element) {
      this.mount(this.options.element);
    }

    this.options.onCreate?.({ editor: this });
  }

  get storage() {
    return this.extensionStorage;
  }

  get commands() {
    return this.commandManager.commands;
  }

  chain() {
    return this.commandManager.chain();
  }

  can() {
    return this.commandManager.can();
  }

  setOptions(options: Partial<EditorOptions> = {}) {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  createState(overrides: CreateStateOptions = {}) {
    if (!this.schema) {
      throw new Error("Cannot create editor state without a resolved schema.");
    }

    const doc = createDocument({
      content: overrides.content ?? this.options.content,
      schema: this.schema,
      parseContent: this.options.parseContent,
    });

    return this.applyStateTransforms(
      EditorState.create({
        schema: this.schema,
        doc,
        selection: Selection.atEnd(doc),
        plugins: overrides.plugins ?? this.plugins,
      })
    );
  }

  mount(element: HTMLElement) {
    if (!element) {
      throw new Error("Editor mount element is required.");
    }
    if (!this.state) {
      this.state = this.initializeState();
    }
    if (!this.state) {
      throw new Error("Editor state is not available. Pass state or content.");
    }
    if (this.view) {
      return this.view;
    }

    const editorProps = this.options.editorProps || {};
    const baseTransformPasted =
      typeof editorProps.transformPasted === "function"
        ? (slice: any, view?: any) => editorProps.transformPasted?.(view, slice) ?? slice
        : undefined;
    const transformPasted = this.extensionManager.transformPasted(baseTransformPasted);
    const baseTransformPastedText =
      typeof editorProps.transformPastedText === "function"
        ? (text: string, plain: boolean, view?: any) =>
            editorProps.transformPastedText?.(view, text, plain) ?? text
        : undefined;
    const transformPastedText = this.extensionManager.transformPastedText(baseTransformPastedText);
    const baseTransformPastedHTML =
      typeof editorProps.transformPastedHTML === "function"
        ? (html: string, view?: any) => editorProps.transformPastedHTML?.(view, html) ?? html
        : undefined;
    const transformPastedHTML = this.extensionManager.transformPastedHTML(baseTransformPastedHTML);
    const resolvedCanvasViewConfig = {
      ...(this.options.canvas || {}),
      ...(editorProps.canvasViewConfig || {}),
      nodeRegistry: editorProps.canvasViewConfig?.nodeRegistry || this.options.canvas?.nodeRegistry || this.nodeRegistry,
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
      transformPasted: (view, slice) => transformPasted(slice, view),
      transformPastedText: (view, text, plain) => transformPastedText(text, plain, view),
      transformPastedHTML: (view, html) => transformPastedHTML(html, view),
    };

    this.view = new CanvasEditorView(element, viewProps);
    return this.view;
  }

  unmount() {
    this.view?.destroy();
    this.view = null;
  }

  destroy() {
    this.unmount();
    this.options.onDestroy?.();
  }

  private buildPlugins() {
    return [
      ...(this.options.plugins || []),
      ...this.resolvedExtensions.state.proseMirrorPlugins,
      ...createShortcutPlugins(this.resolvedExtensions),
      ...createInputRulePlugins(this.resolvedExtensions),
      ...createPasteRulePlugins(this, this.resolvedExtensions),
    ];
  }

  private initializeState() {
    if (this.options.state) {
      return this.options.state;
    }
    if (!this.schema) {
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
}
