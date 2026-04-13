import { createNodeRegistry } from "lumenpage-layout-engine";
import { EditorState, Selection, type Transaction } from "lumenpage-state";
import { CanvasEditorView, type CanvasEditorViewProps } from "lumenpage-view-canvas";

import { createEditorViewProps } from "./bridge/canvas/createEditorViewProps.js";
import { collectNodeSelectionTypes, createSelectionGeometry } from "./bridge/canvas/selectionGeometry.js";
import { CommandManager } from "./CommandManager.js";
import { defaultEditorOptions, hasSchemaSpec } from "./editorConfig.js";
import { EventEmitter } from "./EventEmitter.js";
import { createSchema } from "./createSchema.js";
import { ExtensionManager } from "./ExtensionManager.js";
import { createDocument, type EditorContent } from "./helpers/createDocument.js";
import { resolveEditorExtensions } from "./resolveEditorExtensions.js";
import type {
  AnyExtensionInput,
  CanCommands,
  ChainedCommands,
  CommandMap,
  EditorBaseEvent,
  EditorBeforeTransactionEvent,
  EditorDropEvent,
  EditorEvents,
  EditorFocusEvent,
  EditorPasteEvent,
  EditorPlugin,
  EditorTransactionEvent,
  EnableRules,
  ExtensionStorage,
  ResolvedExtensions,
  SingleCommands,
} from "./types.js";

type CreateStateOptions = {
  content?: EditorContent;
  plugins?: EditorPlugin[];
};

export type EditorOptions = {
  extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput;
  element?: HTMLElement | null;
  content?: EditorContent;
  enableCoreExtensions?: EnableRules;
  editorProps?: Partial<CanvasEditorViewProps>;
  enableInputRules?: EnableRules;
  enablePasteRules?: EnableRules;
  autofocus?: boolean | "start" | "end" | number;
  editable?: boolean;
  onBeforeCreate?: ((args: EditorBaseEvent) => void) | null;
  onMount?: ((args: EditorBaseEvent) => void) | null;
  onUnmount?: ((args: EditorBaseEvent) => void) | null;
  onCreate?: ((args: EditorBaseEvent) => void) | null;
  onBeforeTransaction?: ((args: EditorBeforeTransactionEvent) => void) | null;
  onUpdate?: ((args: EditorTransactionEvent) => void) | null;
  onSelectionUpdate?: ((args: EditorTransactionEvent) => void) | null;
  onTransaction?: ((args: EditorTransactionEvent) => void) | null;
  onFocus?: ((args: EditorFocusEvent) => void) | null;
  onBlur?: ((args: EditorFocusEvent) => void) | null;
  onPaste?: ((args: EditorPasteEvent) => void) | null;
  onDrop?: ((args: EditorDropEvent) => void) | null;
  onDestroy?: ((args: EditorBaseEvent) => void) | null;
};

export class Editor extends EventEmitter<EditorEvents> {
  options: EditorOptions;
  readonly extensionManager: ExtensionManager;
  readonly schema: ReturnType<typeof createSchema> | null;
  readonly nodeRegistry: ReturnType<typeof createNodeRegistry> | null;
  readonly selectionGeometry: ReturnType<typeof createSelectionGeometry>;
  readonly nodeSelectionTypes: string[];
  readonly resolvedExtensions: ResolvedExtensions;
  readonly extensionStorage: Record<string, ExtensionStorage>;
  readonly rawCommands: CommandMap;
  readonly plugins: EditorPlugin[];

  state: EditorState | null;
  view: CanvasEditorView | null;
  isFocused: boolean;
  isCapturingTransaction: boolean;

  private readonly commandManager: CommandManager;
  private customDispatchTransaction: ((transaction: Transaction) => void) | null;
  private capturedTransaction: Transaction | null;

  constructor(options: Partial<EditorOptions> = {}) {
    super();

    this.options = { ...defaultEditorOptions, ...options };
    this.extensionManager = this.createExtensionManager();

    const structure = this.extensionManager.resolveStructure(this);
    this.schema = hasSchemaSpec(structure) ? createSchema(structure) : null;
    this.nodeRegistry = this.schema ? createNodeRegistry(structure) : null;
    this.extensionManager.setRuntime({ schema: this.schema, nodeRegistry: this.nodeRegistry });

    this.selectionGeometry = createSelectionGeometry(structure);
    this.nodeSelectionTypes = collectNodeSelectionTypes(structure);

    const state = this.extensionManager.resolveState(structure, this);
    this.resolvedExtensions = {
      ...structure,
      state,
    };

    this.extensionStorage = Object.fromEntries(
      this.resolvedExtensions.instances.map((instance) => [instance.name, instance.storage])
    );
    this.rawCommands = this.resolvedExtensions.state.commands;
    this.plugins = this.extensionManager.plugins;
    this.state = this.initializeState();
    this.view = null;
    this.isFocused = false;
    this.isCapturingTransaction = false;
    this.customDispatchTransaction = null;
    this.capturedTransaction = null;
    this.commandManager = new CommandManager(this, this.rawCommands);

    this.bindOptionEvents();
    this.extensionManager.bindEditorEvents(this);

    this.emit("beforeCreate", { editor: this });

    if (this.options.element) {
      this.mount(this.options.element);
    }

    this.emit("create", { editor: this });
  }

  get storage() {
    return this.extensionStorage;
  }

  get commands(): SingleCommands {
    return this.commandManager.commands;
  }

  chain(): ChainedCommands {
    return this.commandManager.chain();
  }

  can(): CanCommands {
    return this.commandManager.can();
  }

  get isEditable() {
    return this.options.editable !== false && !!this.view?.editable;
  }

  focus() {
    this.view?.focus();
    return this;
  }

  captureTransaction(fn: () => void) {
    this.isCapturingTransaction = true;
    fn();
    this.isCapturingTransaction = false;

    const transaction = this.capturedTransaction;
    this.capturedTransaction = null;

    return transaction;
  }

  setOptions(options: Partial<EditorOptions> = {}) {
    this.options = {
      ...this.options,
      ...options,
    };

    if (!this.view) {
      return;
    }

    const editorProps = this.options.editorProps || {};
    const dispatchTransaction = this.createViewDispatchTransaction(editorProps);

    this.view.setProps(
      createEditorViewProps({
        editor: this,
        editorProps,
        dispatchTransaction,
      })
    );
  }

  setEditable(editable: boolean, emitUpdate = true) {
    this.setOptions({ editable });

    if (!emitUpdate) {
      return;
    }

    const transaction = this.view?.state?.tr || this.state?.tr;
    if (!transaction) {
      return;
    }

    this.emit("update", {
      editor: this,
      transaction,
      state: this.view?.state || this.state,
      appendedTransactions: [],
    });
  }

  createState(overrides: CreateStateOptions = {}) {
    if (!this.schema) {
      throw new Error("Cannot create editor state without a resolved schema.");
    }

    const doc = createDocument({
      content: overrides.content ?? this.options.content,
      schema: this.schema,
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

    return this.createView(element);
  }

  unmount() {
    if (!this.view) {
      return;
    }

    this.view.destroy();
    this.view = null;
    this.emit("unmount", { editor: this });
  }

  destroy() {
    this.unmount();
    this.emit("destroy", { editor: this });
    this.removeAllListeners();
  }

  handleCoreBeforeInput(_view: unknown, _event: InputEvent) {
    return false;
  }

  private createView(element: HTMLElement) {
    const editorProps = this.options.editorProps || {};
    const dispatchTransaction = this.createViewDispatchTransaction(editorProps);

    this.view = new CanvasEditorView(
      element,
      createEditorViewProps({
        editor: this,
        editorProps,
        dispatchTransaction,
      })
    );

    this.emit("mount", { editor: this });
    return this.view;
  }

  private createViewDispatchTransaction(editorProps: Partial<CanvasEditorViewProps>) {
    this.customDispatchTransaction =
      typeof editorProps.dispatchTransaction === "function" ? editorProps.dispatchTransaction : null;

    return this.extensionManager.dispatchTransaction(this.dispatchTransaction.bind(this));
  }

  private dispatchTransaction(transaction: Transaction) {
    if (!transaction) {
      return;
    }

    if (this.isCapturingTransaction) {
      if (!this.capturedTransaction) {
        this.capturedTransaction = transaction;
        return;
      }

      transaction.steps?.forEach?.((step) => this.capturedTransaction?.step?.(step));
      return;
    }

    if (this.customDispatchTransaction) {
      this.customDispatchTransaction(transaction);
      return;
    }

    const currentState = this.view?.state ?? this.state;
    if (currentState && typeof currentState.applyTransaction === "function") {
      const applied = currentState.applyTransaction(transaction);
      this.emit("beforeTransaction", {
        editor: this,
        transaction,
        nextState: applied?.state ?? currentState,
      });
    }

    const baseDispatch = this.view?._internals?.dispatchTransactionBase;
    if (typeof baseDispatch !== "function") {
      throw new Error("Editor view dispatch pipeline is not initialized.");
    }

    baseDispatch(transaction);
  }

  private initializeState() {
    if (!this.schema) {
      return null;
    }

    return this.createState();
  }

  private applyStateTransforms(state: EditorState) {
    return this.resolvedExtensions.state.stateExtenders.reduce((currentState, transform) => {
      const nextState = transform(currentState);
      return nextState ?? currentState;
    }, state);
  }

  private createExtensionManager() {
    return new ExtensionManager(
      resolveEditorExtensions({
        extensions: this.options.extensions,
        enableCoreExtensions: this.options.enableCoreExtensions,
      }),
      this
    );
  }

  private bindOptionEvents() {
    const events: Array<
      [keyof EditorEvents, ((payload: EditorEvents[keyof EditorEvents]) => void) | null | undefined]
    > = [
      ["mount", this.options.onMount],
      ["unmount", this.options.onUnmount],
      ["beforeCreate", this.options.onBeforeCreate],
      ["create", this.options.onCreate],
      ["beforeTransaction", this.options.onBeforeTransaction],
      ["update", this.options.onUpdate],
      ["selectionUpdate", this.options.onSelectionUpdate],
      ["transaction", this.options.onTransaction],
      ["focus", this.options.onFocus],
      ["blur", this.options.onBlur],
      ["paste", this.options.onPaste],
      ["drop", this.options.onDrop],
      ["destroy", this.options.onDestroy],
    ];

    for (const [event, listener] of events) {
      if (typeof listener === "function") {
        this.on(event, listener);
      }
    }
  }
}
