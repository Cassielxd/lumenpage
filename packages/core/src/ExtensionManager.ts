import { getExtensionField } from "./Extendable";
import { applyGlobalAttributesToSchema, resolveExtensionSchema } from "./schemaFields";
import type {
  AnyExtension,
  AnyExtensionInput,
  CanvasHooks,
  ExtensionContext,
  ExtensionInstance,
  GlobalAttributes,
  LayoutHooks,
  ResolvedExtensions,
  ResolvedState,
  ResolvedStructure,
  SchemaSpec,
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
  proseMirrorPlugins: [],
  keyboardShortcuts: [],
  inputRules: [],
  commands: {},
  stateTransforms: [],
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

  constructor(extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput, editor: any = null) {
    this.editor = editor;
    this.schema = null;
    this.nodeRegistry = null;
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
    };
    const canvas = createResolvedCanvas();

    for (const instance of instances) {
      const ctx = this.createContext(instance, editor);

      const directSchema = this.resolveDirectSchema(instance, ctx);
      if (directSchema) {
        this.applyDirectSchema(schema, instance, directSchema);
      }

      const schemaSpec = callConfigValue(
        getExtensionField<() => SchemaSpec | null>(instance.extension, "addSchema", ctx),
        null
      );
      if (schemaSpec) {
        this.applySchemaSpec(schema, schemaSpec, instance.name);
      }

      const layoutHooks = callConfigValue(
        getExtensionField<() => LayoutHooks | null>(instance.extension, "addLayout", ctx),
        null
      );
      if (layoutHooks) {
        layout.byNodeName.set(instance.name, layoutHooks);
      }

      const canvasHooks = callConfigValue(
        getExtensionField<() => CanvasHooks | null>(instance.extension, "addCanvas", ctx),
        null
      );
      if (canvasHooks) {
        this.applyCanvasHooks(canvas, canvasHooks);
      }

      if (instance.type === "node") {
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

      const proseMirrorPlugins = callConfigValue(
        getExtensionField<() => any[]>(instance.extension, "addProseMirrorPlugins", ctx),
        []
      );
      if (proseMirrorPlugins.length) {
        state.proseMirrorPlugins.push(...proseMirrorPlugins);
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
      if (inputRules.length) {
        state.inputRules.push(...inputRules);
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

      const stateTransforms = callConfigValue(
        getExtensionField<() => Array<(state: any) => any> | ((state: any) => any) | null>(
          instance.extension,
          "addStateTransforms",
          ctx
        ),
        null
      );
      if (Array.isArray(stateTransforms) && stateTransforms.length) {
        state.stateTransforms.push(...stateTransforms.filter((transform) => typeof transform === "function"));
      } else if (typeof stateTransforms === "function") {
        state.stateTransforms.push(stateTransforms);
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
