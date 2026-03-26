import { inputRules } from "lumenpage-inputrules";
import { keymap } from "lumenpage-keymap";
import type { MarkSpec, NodeSpec, Schema, Slice } from "lumenpage-model";
import type { NodeRendererRegistry } from "lumenpage-layout-engine";
import type { Transaction } from "lumenpage-state";
import type { CanvasEditorView, NodeViewFactory } from "lumenpage-view-canvas";

import type { Editor } from "./Editor";
import { getExtensionField } from "./Extendable";
import { pasteRulesPlugin } from "./PasteRule";
import { applyGlobalAttributesToSchema, resolveExtensionSchema } from "./schemaFields";
import type {
  AnyExtension,
  AnyExtensionInput,
  CanvasHooks,
  ClipboardParserLike,
  ClipboardSerializerLike,
  ClipboardTextParser,
  ClipboardTextSerializer,
  CommandMap,
  DispatchTransactionProps,
  EditorPlugin,
  EnableRules,
  ExtensionContext,
  ExtensionInstance,
  ExtensionStorage,
  GlobalAttributes,
  KeyboardShortcutMap,
  LayoutHooks,
  MarkAdapter,
  MarkAdapterMap,
  MarkAnnotationResolver,
  MarkAnnotationResolverMap,
  ResolvedExtensions,
  ResolvedState,
  ResolvedStructure,
  StateExtender,
} from "./types";

const flattenExtensions = (
  input: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput
): AnyExtension[] => {
  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenExtensions(item));
  }
  return input ? [input as AnyExtension] : [];
};

const createResolvedSchema = (): ResolvedStructure["schema"] => ({
  nodes: {},
  marks: {},
});

const createResolvedState = (): ResolvedState => ({
  plugins: [],
  keyboardShortcuts: [],
  inputRules: [],
  pasteRules: [],
  commands: {},
  stateExtenders: [],
});

const createResolvedCanvas = (): ResolvedStructure["canvas"] => ({
  nodeViews: {},
  markAdapters: {},
  markAnnotationResolvers: {},
  selectionGeometries: [],
  nodeSelectionTypes: [],
  decorationProviders: [],
  hitTestPolicies: [],
});

const sortByPriority = <T extends { priority: number }>(items: T[]) =>
  [...items].sort((a, b) => b.priority - a.priority);

const isExtensionRulesEnabled = (
  extension: AnyExtension,
  enabled: EnableRules | undefined
) => {
  if (Array.isArray(enabled)) {
    return enabled.some((entry) => {
      const name = typeof entry === "string" ? entry : entry?.name;
      return name === extension.name;
    });
  }

  return enabled !== false;
};

const callConfigValue = <Value>(value: Value | (() => Value) | undefined, fallback: Value) => {
  if (typeof value === "function") {
    return (value as () => Value)();
  }
  return value ?? fallback;
};

export class ExtensionManager {
  readonly extensions: AnyExtension[];

  editor: Editor | null;
  schema: Schema | null;
  nodeRegistry: NodeRendererRegistry | null;
  private boundEditor: Editor | null;

  constructor(extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput, editor: Editor | null = null) {
    this.editor = editor;
    this.schema = null;
    this.nodeRegistry = null;
    this.boundEditor = null;
    this.extensions = this.resolveExtensions(extensions);
  }

  setRuntime({ schema, nodeRegistry }: { schema?: Schema | null; nodeRegistry?: NodeRendererRegistry | null }) {
    this.schema = schema ?? null;
    this.nodeRegistry = nodeRegistry ?? null;
  }

  get plugins(): EditorPlugin[] {
    const editor = this.editor;

    if (!editor) {
      return [];
    }

    const resolved = editor.resolvedExtensions ?? this.resolve(editor);
    const plugins: EditorPlugin[] = [...resolved.state.plugins];

    plugins.push(
      ...resolved.state.keyboardShortcuts
        .filter((shortcuts) => shortcuts && Object.keys(shortcuts).length > 0)
        .map((shortcuts) => keymap(shortcuts))
    );

    const inputRuleSet = resolved.state.inputRules.filter(Boolean);
    if (inputRuleSet.length) {
      plugins.push(inputRules({ rules: inputRuleSet }));
    }

    const pasteRuleSet = resolved.state.pasteRules.filter(Boolean);
    if (pasteRuleSet.length) {
      plugins.push(...pasteRulesPlugin({ editor, rules: pasteRuleSet }));
    }

    return plugins;
  }

  resolveStructure(editor: Editor | null = this.editor): ResolvedStructure {
    const instances = this.createInstances(editor);
    const schema = createResolvedSchema();
    const layout = {
      byNodeName: new Map<string, LayoutHooks>(),
      renderPresetsByNodeName: new Map<string, string>(),
    };
    const canvas = createResolvedCanvas();

    for (const instance of instances) {
      const ctx = this.createContext(instance, editor);

      const directSchema = this.resolveDirectSchema(instance, ctx);
      if (directSchema) {
        this.applyDirectSchema(schema, instance, directSchema);
      }

      const layoutHooks = callConfigValue(
        getExtensionField<() => LayoutHooks | null>(instance.extension, "layout", ctx),
        null
      );
      if (layoutHooks) {
        layout.byNodeName.set(instance.name, layoutHooks);
      }

      const canvasHooks = callConfigValue(
        getExtensionField<() => CanvasHooks | null>(instance.extension, "canvas", ctx),
        null
      );
      if (canvasHooks) {
        this.applyCanvasHooks(canvas, canvasHooks);
      }

      const markAdapters = callConfigValue(
        getExtensionField<() => MarkAdapterMap>(instance.extension, "addMarkAdapters", ctx),
        {}
      );
      if (markAdapters && Object.keys(markAdapters).length) {
        canvas.markAdapters = {
          ...canvas.markAdapters,
          ...markAdapters,
        };
      }

      const markAnnotationResolvers = callConfigValue(
        getExtensionField<() => MarkAnnotationResolverMap>(
          instance.extension,
          "addMarkAnnotations",
          ctx
        ),
        {}
      );
      if (markAnnotationResolvers && Object.keys(markAnnotationResolvers).length) {
        canvas.markAnnotationResolvers = {
          ...canvas.markAnnotationResolvers,
          ...markAnnotationResolvers,
        };
      }

      if (instance.type === "node") {
        const renderPreset = callConfigValue(
          getExtensionField<() => string | null>(instance.extension, "renderPreset", ctx),
          null
        );
        if (renderPreset) {
          layout.renderPresetsByNodeName.set(instance.name, renderPreset);
        }

        const nodeView = callConfigValue(
          getExtensionField<() => NodeViewFactory | null>(instance.extension, "addNodeView", ctx),
          null
        );
        if (nodeView) {
          canvas.nodeViews[instance.name] = nodeView;
        }
      }

      if (instance.type === "mark") {
        const markAdapter = callConfigValue(
          getExtensionField<() => MarkAdapter | null>(instance.extension, "addMarkAdapter", ctx),
          null
        );
        if (typeof markAdapter === "function") {
          canvas.markAdapters[instance.name] = markAdapter;
        }

        const markAnnotationResolver = callConfigValue(
          getExtensionField<() => MarkAnnotationResolver | null>(instance.extension, "addMarkAnnotation", ctx),
          null
        );
        if (typeof markAnnotationResolver === "function") {
          canvas.markAnnotationResolvers[instance.name] = markAnnotationResolver;
        }
      }
    }

    applyGlobalAttributesToSchema(schema, this.resolveGlobalAttributes(instances, editor));

    canvas.nodeSelectionTypes = Array.from(new Set(canvas.nodeSelectionTypes));

    return {
      instances,
      schema,
      layout,
      canvas,
    };
  }

  resolveState(input: ResolvedStructure | ExtensionInstance[], editor: Editor | null = this.editor): ResolvedState {
    const instances = Array.isArray(input) ? input : input.instances;
    const state = createResolvedState();

    for (const instance of instances) {
      const ctx = this.createContext(instance, editor);

      const plugins = callConfigValue(
        getExtensionField<() => EditorPlugin[]>(instance.extension, "addPlugins", ctx),
        []
      );
      if (plugins.length) {
        state.plugins.push(...plugins);
      }

      const keyboardShortcuts = callConfigValue(
        getExtensionField<() => KeyboardShortcutMap>(instance.extension, "addKeyboardShortcuts", ctx),
        {}
      );
      if (keyboardShortcuts && Object.keys(keyboardShortcuts).length) {
        state.keyboardShortcuts.push(keyboardShortcuts);
      }

      const inputRules = callConfigValue(
        getExtensionField<() => ResolvedState["inputRules"]>(instance.extension, "addInputRules", ctx),
        []
      );
      if (
        isExtensionRulesEnabled(instance.extension, this.editor?.options?.enableInputRules) &&
        inputRules.length
      ) {
        state.inputRules.push(...inputRules);
      }

      const pasteRules = callConfigValue(
        getExtensionField<() => ResolvedState["pasteRules"]>(instance.extension, "addPasteRules", ctx),
        []
      );
      if (
        isExtensionRulesEnabled(instance.extension, this.editor?.options?.enablePasteRules) &&
        pasteRules.length
      ) {
        state.pasteRules.push(...pasteRules);
      }

      const commands = callConfigValue(
        getExtensionField<() => CommandMap>(instance.extension, "addCommands", ctx),
        {}
      );
      if (commands && Object.keys(commands).length) {
        state.commands = {
          ...commands,
          ...state.commands,
        };
      }

      const stateExtenders = callConfigValue(
        getExtensionField<() => StateExtender[] | StateExtender | null>(
          instance.extension,
          "extendState",
          ctx
        ),
        null
      );
      if (Array.isArray(stateExtenders) && stateExtenders.length) {
        state.stateExtenders.push(...stateExtenders.filter((transform) => typeof transform === "function"));
      } else if (typeof stateExtenders === "function") {
        state.stateExtenders.push(stateExtenders);
      }
    }

    return state;
  }

  resolve(editor: Editor | null = this.editor): ResolvedExtensions {
    const structure = this.resolveStructure(editor);
    const state = this.resolveState(structure, editor);
    return {
      ...structure,
      state,
    };
  }

  dispatchTransaction(baseDispatch: (transaction: Transaction) => void) {
    const extensions = sortByPriority([...this.extensions]);

    return extensions.reduceRight((next, extension) => {
      const ctx = this.createDetachedContext(extension);
      const dispatchTransaction = getExtensionField<
        ((props: DispatchTransactionProps) => void) | undefined
      >(extension, "dispatchTransaction", ctx);

      if (!dispatchTransaction) {
        return next;
      }

      return (transaction: Transaction) => {
        dispatchTransaction.call(ctx, { transaction, next });
      };
    }, baseDispatch);
  }

  transformPastedHTML(baseTransform?: (html: string, view?: CanvasEditorView | null) => string) {
    const extensions = sortByPriority([...this.extensions]);

    return extensions.reduce(
      (transform, extension) => {
        const ctx = this.createDetachedContext(extension);
        const extensionTransform = getExtensionField<(html: string) => string | null | undefined>(
          extension,
          "transformPastedHTML",
          ctx
        );

        if (!extensionTransform) {
          return transform;
        }

        return (html: string, view?: CanvasEditorView | null) => {
          const transformedHtml = transform(html, view);
          return extensionTransform(transformedHtml) ?? transformedHtml;
        };
      },
      baseTransform || ((html: string) => html)
    );
  }

  transformPastedText(baseTransform?: (text: string, plain: boolean, view?: CanvasEditorView | null) => string) {
    const extensions = sortByPriority([...this.extensions]);

    return extensions.reduce(
      (transform, extension) => {
        const ctx = this.createDetachedContext(extension);
        const extensionTransform = getExtensionField<
          (text: string, plain: boolean) => string | null | undefined
        >(extension, "transformPastedText", ctx);

        if (!extensionTransform) {
          return transform;
        }

        return (text: string, plain: boolean, view?: CanvasEditorView | null) => {
          const transformedText = transform(text, plain, view);
          return extensionTransform(transformedText, plain) ?? transformedText;
        };
      },
      baseTransform || ((text: string) => text)
    );
  }

  transformPasted(baseTransform?: (slice: Slice, view?: CanvasEditorView | null) => Slice) {
    const extensions = sortByPriority([...this.extensions]);

    return extensions.reduce(
      (transform, extension) => {
        const ctx = this.createDetachedContext(extension);
        const extensionTransform = getExtensionField<(slice: Slice) => Slice | null | undefined>(
          extension,
          "transformPasted",
          ctx
        );

        if (!extensionTransform) {
          return transform;
        }

        return (slice: Slice, view?: CanvasEditorView | null) => {
          const transformedSlice = transform(slice, view);
          return extensionTransform(transformedSlice) ?? transformedSlice;
        };
      },
      baseTransform || ((slice: Slice) => slice)
    );
  }

  transformCopied(baseTransform?: (slice: Slice, view?: CanvasEditorView | null) => Slice) {
    const extensions = sortByPriority([...this.extensions]);

    return extensions.reduce(
      (transform, extension) => {
        const ctx = this.createDetachedContext(extension);
        const extensionTransform = getExtensionField<(slice: Slice) => Slice | null | undefined>(
          extension,
          "transformCopied",
          ctx
        );

        if (!extensionTransform) {
          return transform;
        }

        return (slice: Slice, view?: CanvasEditorView | null) => {
          const transformedSlice = transform(slice, view);
          return extensionTransform(transformedSlice) ?? transformedSlice;
        };
      },
      baseTransform || ((slice: Slice) => slice)
    );
  }

  transformCopiedHTML(baseTransform?: (html: string, slice?: Slice, view?: CanvasEditorView | null) => string) {
    const extensions = sortByPriority([...this.extensions]);

    return extensions.reduce(
      (transform, extension) => {
        const ctx = this.createDetachedContext(extension);
        const extensionTransform = getExtensionField<
          (html: string, slice?: Slice) => string | null | undefined
        >(extension, "transformCopiedHTML", ctx);

        if (!extensionTransform) {
          return transform;
        }

        return (html: string, slice?: Slice, view?: CanvasEditorView | null) => {
          const transformedHtml = transform(html, slice, view);
          return extensionTransform(transformedHtml, slice) ?? transformedHtml;
        };
      },
      baseTransform || ((html: string) => html)
    );
  }

  clipboardTextSerializer(baseSerializer?: ClipboardTextSerializer) {
    const extensions = sortByPriority([...this.extensions]);

    return (slice: Slice, view?: CanvasEditorView | null) => {
      for (const extension of extensions) {
        const ctx = this.createDetachedContext(extension);
        const serializer = getExtensionField<(slice: Slice) => string | null | undefined>(
          extension,
          "clipboardTextSerializer",
          ctx
        );
        if (!serializer) {
          continue;
        }
        const text = serializer(slice);
        if (text != null) {
          return text;
        }
      }
      return baseSerializer ? baseSerializer(slice, view) : null;
    };
  }

  clipboardTextParser(baseParser?: ClipboardTextParser) {
    const extensions = sortByPriority([...this.extensions]);

    return (text: string, context?: unknown, plain?: boolean, view?: CanvasEditorView | null) => {
      for (const extension of extensions) {
        const ctx = this.createDetachedContext(extension);
        const parser = getExtensionField<(text: string, context?: unknown, plain?: boolean) => Slice | null | undefined>(
          extension,
          "clipboardTextParser",
          ctx
        );
        if (!parser) {
          continue;
        }
        const slice = parser(text, context, plain);
        if (slice != null) {
          return slice;
        }
      }
      return baseParser ? baseParser(text, context, plain, view) : null;
    };
  }

  clipboardParser(baseParser?: ClipboardParserLike | null) {
    const extensions = sortByPriority([...this.extensions]);

    for (const extension of extensions) {
      const ctx = this.createDetachedContext(extension);
      const parser = callConfigValue(
        getExtensionField<ClipboardParserLike | (() => ClipboardParserLike | null)>(
          extension,
          "clipboardParser",
          ctx
        ),
        null
      );
      if (parser != null) {
        return parser;
      }
    }

    return baseParser ?? null;
  }

  clipboardSerializer(baseSerializer?: ClipboardSerializerLike | null) {
    const extensions = sortByPriority([...this.extensions]);

    for (const extension of extensions) {
      const ctx = this.createDetachedContext(extension);
      const serializer = callConfigValue(
        getExtensionField<ClipboardSerializerLike | (() => ClipboardSerializerLike | null)>(
          extension,
          "clipboardSerializer",
          ctx
        ),
        null
      );
      if (serializer != null) {
        return serializer;
      }
    }

    return baseSerializer ?? null;
  }

  bindEditorEvents(editor: Editor | null = this.editor) {
    if (!editor || this.boundEditor === editor) {
      return;
    }

    this.boundEditor = editor;
    const eventMap = [
      ["mount", "onMount"],
      ["unmount", "onUnmount"],
      ["beforeCreate", "onBeforeCreate"],
      ["create", "onCreate"],
      ["beforeTransaction", "onBeforeTransaction"],
      ["update", "onUpdate"],
      ["selectionUpdate", "onSelectionUpdate"],
      ["transaction", "onTransaction"],
      ["focus", "onFocus"],
      ["blur", "onBlur"],
      ["paste", "onPaste"],
      ["drop", "onDrop"],
      ["destroy", "onDestroy"],
    ] as const;

    for (const extension of sortByPriority([...this.extensions])) {
      const ctx = this.createDetachedContext(extension);

      for (const [eventName, fieldName] of eventMap) {
        const handler = getExtensionField<(event: unknown) => void>(extension, fieldName, ctx);
        if (typeof handler === "function") {
          editor.on(eventName, handler);
        }
      }
    }
  }

  private resolveExtensions(input: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput): AnyExtension[] {
    const resolved: AnyExtension[] = [];

    for (const extension of flattenExtensions(input)) {
      resolved.push(extension);
      const nested = this.resolveNestedExtensions(extension);
      if (nested.length) {
        resolved.push(...nested);
      }
    }

    return sortByPriority(resolved);
  }

  private resolveNestedExtensions(extension: AnyExtension) {
    const context = this.createDetachedContext(extension);
    const addExtensions = getExtensionField<() => ReadonlyArray<AnyExtensionInput>>(
      extension,
      "addExtensions",
      context
    );
    const nested = addExtensions?.() || [];
    return nested.length ? this.resolveExtensions(nested) : [];
  }

  private createInstances(editor: Editor | null = this.editor) {
    const seenNames = new Set<string>();
    const instances: ExtensionInstance[] = [];

    for (const extension of this.extensions) {
      const name = String(extension.name || "").trim();
      if (!name) {
        throw new Error("Extension name is required.");
      }
      if (seenNames.has(name)) {
        throw new Error(`Duplicate extension name: ${name}`);
      }
      seenNames.add(name);

      const options = this.resolveOptions(extension);
      const storage = this.resolveStorage(extension, options, editor);

      instances.push({
        name,
        type: extension.type,
        priority: extension.priority,
        options,
        storage,
        extension,
      });
    }

    return sortByPriority(instances);
  }

  private resolveOptions(extension: AnyExtension) {
    const defaults = callConfigValue(
      getExtensionField<() => Record<string, unknown>>(extension, "addOptions", {
        name: extension.name,
      }),
      {}
    );

    return {
      ...defaults,
      ...(extension.options || {}),
    };
  }

  private resolveStorage(extension: AnyExtension, options: Record<string, unknown>, editor: Editor | null) {
    const storage = callConfigValue(
      getExtensionField<() => ExtensionStorage>(extension, "addStorage", {
        name: extension.name,
        options,
        editor,
        manager: this,
        schema: this.schema,
        nodeRegistry: this.nodeRegistry,
      }),
      {}
    );

    return storage ?? {};
  }

  private createDetachedContext(extension: AnyExtension): ExtensionContext {
    const options = this.resolveOptions(extension);
    const storage = this.resolveStorage(extension, options, this.editor);

    return {
      name: extension.name,
      options,
      storage,
      editor: this.editor,
      manager: this,
      schema: this.schema,
      nodeRegistry: this.nodeRegistry,
    };
  }

  private createContext(instance: ExtensionInstance, editor: Editor | null = this.editor): ExtensionContext {
    return {
      name: instance.name,
      options: instance.options,
      storage: instance.storage,
      editor,
      manager: this,
      schema: this.schema,
      nodeRegistry: this.nodeRegistry,
    };
  }

  private resolveDirectSchema(instance: ExtensionInstance, ctx: ExtensionContext) {
    return resolveExtensionSchema(instance, ctx);
  }

  private resolveGlobalAttributes(instances: ExtensionInstance[], editor: Editor | null = this.editor): GlobalAttributes {
    const resolved: GlobalAttributes = [];

    for (const instance of instances) {
      const ctx = this.createContext(instance, editor);
      const attributes = callConfigValue(
        getExtensionField<() => GlobalAttributes>(instance.extension, "addGlobalAttributes", ctx),
        []
      );
      if (Array.isArray(attributes) && attributes.length) {
        resolved.push(...attributes);
      }
    }

    return resolved;
  }

  private applyDirectSchema(
    target: ResolvedStructure["schema"],
    instance: ExtensionInstance,
    schemaSpec: NodeSpec | MarkSpec
  ) {
    if (instance.type === "node") {
      if (instance.name in target.nodes) {
        throw new Error(`Duplicate schema node \"${instance.name}\" from extension \"${instance.name}\"`);
      }
      target.nodes[instance.name] = schemaSpec as NodeSpec;
      return;
    }

    if (instance.name in target.marks) {
      throw new Error(`Duplicate schema mark \"${instance.name}\" from extension \"${instance.name}\"`);
    }
    target.marks[instance.name] = schemaSpec as MarkSpec;
  }

  private applyCanvasHooks(target: ResolvedStructure["canvas"], canvasHooks: CanvasHooks) {
    if (canvasHooks.nodeViews) {
      target.nodeViews = {
        ...target.nodeViews,
        ...canvasHooks.nodeViews,
      };
    }
    if (canvasHooks.selectionGeometries?.length) {
      target.selectionGeometries.push(...canvasHooks.selectionGeometries);
    }
    if (canvasHooks.nodeSelectionTypes?.length) {
      target.nodeSelectionTypes.push(...canvasHooks.nodeSelectionTypes);
    }
    if (canvasHooks.decorationProviders?.length) {
      target.decorationProviders.push(...canvasHooks.decorationProviders);
    }
    if (canvasHooks.hitTestPolicies?.length) {
      target.hitTestPolicies.push(...canvasHooks.hitTestPolicies);
    }
  }
}
