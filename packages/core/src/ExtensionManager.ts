import { getExtensionField } from "./Extendable";
import { applyGlobalAttributesToSchema, resolveExtensionSchema } from "./schemaFields";
import type {
  AnyExtension,
  AnyExtensionInput,
  CanvasHooks,
  EnableRules,
  ExtensionContext,
  ExtensionInstance,
  GlobalAttributes,
  LayoutHooks,
  ResolvedExtensions,
  ResolvedState,
  ResolvedStructure,
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

  editor: any | null;
  schema: any | null;
  nodeRegistry: any | null;
  private boundEditor: any | null;

  constructor(extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput, editor: any = null) {
    this.editor = editor;
    this.schema = null;
    this.nodeRegistry = null;
    this.boundEditor = null;
    this.extensions = this.resolveExtensions(extensions);
  }

  setRuntime({ schema, nodeRegistry }: { schema?: any; nodeRegistry?: any }) {
    this.schema = schema ?? null;
    this.nodeRegistry = nodeRegistry ?? null;
  }

  resolveStructure(editor: any = this.editor): ResolvedStructure {
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

      if (instance.type === "node") {
        const renderPreset = callConfigValue(
          getExtensionField<() => string | null>(instance.extension, "renderPreset", ctx),
          null
        );
        if (renderPreset) {
          layout.renderPresetsByNodeName.set(instance.name, renderPreset);
        }

        const nodeView = callConfigValue(
          getExtensionField<() => any>(instance.extension, "addNodeView", ctx),
          null
        );
        if (nodeView) {
          canvas.nodeViews[instance.name] = nodeView;
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

  resolveState(input: ResolvedStructure | ExtensionInstance[], editor: any = this.editor): ResolvedState {
    const instances = Array.isArray(input) ? input : input.instances;
    const state = createResolvedState();

    for (const instance of instances) {
      const ctx = this.createContext(instance, editor);

      const plugins = callConfigValue(
        getExtensionField<() => any[]>(instance.extension, "addPlugins", ctx),
        []
      );
      if (plugins.length) {
        state.plugins.push(...plugins);
      }

      const keyboardShortcuts = callConfigValue(
        getExtensionField<() => Record<string, any>>(instance.extension, "addKeyboardShortcuts", ctx),
        {}
      );
      if (keyboardShortcuts && Object.keys(keyboardShortcuts).length) {
        state.keyboardShortcuts.push(keyboardShortcuts);
      }

      const inputRules = callConfigValue(
        getExtensionField<() => any[]>(instance.extension, "addInputRules", ctx),
        []
      );
      if (
        isExtensionRulesEnabled(instance.extension, this.editor?.options?.enableInputRules) &&
        inputRules.length
      ) {
        state.inputRules.push(...inputRules);
      }

      const pasteRules = callConfigValue(
        getExtensionField<() => any[]>(instance.extension, "addPasteRules", ctx),
        []
      );
      if (
        isExtensionRulesEnabled(instance.extension, this.editor?.options?.enablePasteRules) &&
        pasteRules.length
      ) {
        state.pasteRules.push(...pasteRules);
      }

      const commands = callConfigValue(
        getExtensionField<() => Record<string, any>>(instance.extension, "addCommands", ctx),
        {}
      );
      if (commands && Object.keys(commands).length) {
        state.commands = {
          ...state.commands,
          ...commands,
        };
      }

      const stateExtenders = callConfigValue(
        getExtensionField<() => Array<(state: any) => any> | ((state: any) => any) | null>(
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

  resolve(editor: any = this.editor): ResolvedExtensions {
    const structure = this.resolveStructure(editor);
    const state = this.resolveState(structure, editor);
    return {
      ...structure,
      state,
    };
  }

  transformPastedHTML(baseTransform?: (html: string, view?: any) => string) {
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

        return (html: string, view?: any) => {
          const transformedHtml = transform(html, view);
          return extensionTransform(transformedHtml) ?? transformedHtml;
        };
      },
      baseTransform || ((html: string) => html)
    );
  }

  transformPastedText(baseTransform?: (text: string, plain: boolean, view?: any) => string) {
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

        return (text: string, plain: boolean, view?: any) => {
          const transformedText = transform(text, plain, view);
          return extensionTransform(transformedText, plain) ?? transformedText;
        };
      },
      baseTransform || ((text: string) => text)
    );
  }

  transformPasted(baseTransform?: (slice: any, view?: any) => any) {
    const extensions = sortByPriority([...this.extensions]);

    return extensions.reduce(
      (transform, extension) => {
        const ctx = this.createDetachedContext(extension);
        const extensionTransform = getExtensionField<(slice: any) => any>(
          extension,
          "transformPasted",
          ctx
        );

        if (!extensionTransform) {
          return transform;
        }

        return (slice: any, view?: any) => {
          const transformedSlice = transform(slice, view);
          return extensionTransform(transformedSlice) ?? transformedSlice;
        };
      },
      baseTransform || ((slice: any) => slice)
    );
  }

  transformCopied(baseTransform?: (slice: any, view?: any) => any) {
    const extensions = sortByPriority([...this.extensions]);

    return extensions.reduce(
      (transform, extension) => {
        const ctx = this.createDetachedContext(extension);
        const extensionTransform = getExtensionField<(slice: any) => any>(
          extension,
          "transformCopied",
          ctx
        );

        if (!extensionTransform) {
          return transform;
        }

        return (slice: any, view?: any) => {
          const transformedSlice = transform(slice, view);
          return extensionTransform(transformedSlice) ?? transformedSlice;
        };
      },
      baseTransform || ((slice: any) => slice)
    );
  }

  transformCopiedHTML(baseTransform?: (html: string, slice?: any, view?: any) => string) {
    const extensions = sortByPriority([...this.extensions]);

    return extensions.reduce(
      (transform, extension) => {
        const ctx = this.createDetachedContext(extension);
        const extensionTransform = getExtensionField<
          (html: string, slice?: any) => string | null | undefined
        >(extension, "transformCopiedHTML", ctx);

        if (!extensionTransform) {
          return transform;
        }

        return (html: string, slice?: any, view?: any) => {
          const transformedHtml = transform(html, slice, view);
          return extensionTransform(transformedHtml, slice) ?? transformedHtml;
        };
      },
      baseTransform || ((html: string) => html)
    );
  }

  clipboardTextSerializer(baseSerializer?: (slice: any, view?: any) => string | null) {
    const extensions = sortByPriority([...this.extensions]);

    return (slice: any, view?: any) => {
      for (const extension of extensions) {
        const ctx = this.createDetachedContext(extension);
        const serializer = getExtensionField<(slice: any) => string | null | undefined>(
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

  clipboardTextParser(baseParser?: (text: string, context?: any, plain?: boolean, view?: any) => any) {
    const extensions = sortByPriority([...this.extensions]);

    return (text: string, context?: any, plain?: boolean, view?: any) => {
      for (const extension of extensions) {
        const ctx = this.createDetachedContext(extension);
        const parser = getExtensionField<(text: string, context?: any, plain?: boolean) => any>(
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

  clipboardParser(baseParser?: any) {
    const extensions = sortByPriority([...this.extensions]);

    for (const extension of extensions) {
      const ctx = this.createDetachedContext(extension);
      const parser = getExtensionField<any>(extension, "clipboardParser", ctx);
      if (parser != null) {
        return parser;
      }
    }

    return baseParser ?? null;
  }

  clipboardSerializer(baseSerializer?: any) {
    const extensions = sortByPriority([...this.extensions]);

    for (const extension of extensions) {
      const ctx = this.createDetachedContext(extension);
      const serializer = getExtensionField<any>(extension, "clipboardSerializer", ctx);
      if (serializer != null) {
        return serializer;
      }
    }

    return baseSerializer ?? null;
  }

  bindEditorEvents(editor: any = this.editor) {
    if (!editor || this.boundEditor === editor) {
      return;
    }

    this.boundEditor = editor;
    const eventMap = [
      ["mount", "onMount"],
      ["unmount", "onUnmount"],
      ["beforeCreate", "onBeforeCreate"],
      ["create", "onCreate"],
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
        const handler = getExtensionField<(event: any) => void>(extension, fieldName, ctx);
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

  private createInstances(editor: any = this.editor) {
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
      getExtensionField<() => Record<string, any>>(extension, "addOptions", {
        name: extension.name,
      }),
      {}
    );

    return {
      ...defaults,
      ...(extension.options || {}),
    };
  }

  private resolveStorage(extension: AnyExtension, options: any, editor: any) {
    const storage = callConfigValue(
      getExtensionField<() => any>(extension, "addStorage", {
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

  private createContext(instance: ExtensionInstance, editor: any = this.editor): ExtensionContext {
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

  private resolveGlobalAttributes(instances: ExtensionInstance[], editor: any = this.editor): GlobalAttributes {
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
    schemaSpec: Record<string, any>
  ) {
    if (instance.type === "node") {
      if (instance.name in target.nodes) {
        throw new Error(`Duplicate schema node \"${instance.name}\" from extension \"${instance.name}\"`);
      }
      target.nodes[instance.name] = schemaSpec;
      return;
    }

    if (instance.name in target.marks) {
      throw new Error(`Duplicate schema mark \"${instance.name}\" from extension \"${instance.name}\"`);
    }
    target.marks[instance.name] = schemaSpec;
  }

  private applySchemaSpec(
    target: ResolvedStructure["schema"],
    schemaSpec: SchemaSpec,
    extensionName: string
  ) {
    for (const [name, spec] of Object.entries(schemaSpec.nodes || {})) {
      if (name in target.nodes) {
        throw new Error(`Duplicate schema node \"${name}\" from extension \"${extensionName}\"`);
      }
      target.nodes[name] = spec;
    }

    for (const [name, spec] of Object.entries(schemaSpec.marks || {})) {
      if (name in target.marks) {
        throw new Error(`Duplicate schema mark \"${name}\" from extension \"${extensionName}\"`);
      }
      target.marks[name] = spec;
    }
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
