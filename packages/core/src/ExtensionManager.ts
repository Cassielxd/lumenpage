import type {
  LumenCanvasHooks,
  LumenExtensionContext,
  LumenExtensionInput,
  LumenExtensionInstance,
  LumenExtensionLike,
  LumenLayoutHooks,
  LumenResolvedExtensions,
  LumenResolvedState,
  LumenResolvedStructure,
  LumenSchemaSpec,
} from "./types";

const flattenExtensions = (
  input: ReadonlyArray<LumenExtensionInput> | LumenExtensionInput
): LumenExtensionLike[] => {
  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenExtensions(item));
  }
  return "config" in input ? [input] : [];
};

const createResolvedSchema = (): LumenResolvedStructure["schema"] => ({
  nodes: {},
  marks: {},
});

const createResolvedState = (): LumenResolvedState => ({
  plugins: [],
  shortcuts: [],
  inputRules: [],
  commands: {},
  stateTransforms: [],
});

const createResolvedCanvas = (): LumenResolvedStructure["canvas"] => ({
  nodeViews: {},
  selectionGeometries: [],
  nodeSelectionTypes: [],
  decorationProviders: [],
  hitTestPolicies: [],
});

export class LumenExtensionManager {
  extensions: LumenExtensionLike[];

  constructor(extensions: ReadonlyArray<LumenExtensionInput> | LumenExtensionInput) {
    this.extensions = flattenExtensions(extensions);
  }

  resolveStructure(editor: any = null): LumenResolvedStructure {
    const instances = this.createInstances(editor);
    const schema = createResolvedSchema();
    const layout = {
      byNodeName: new Map<string, LumenLayoutHooks>(),
    };
    const canvas = createResolvedCanvas();

    for (const instance of instances) {
      const ctx: LumenExtensionContext = {
        name: instance.name,
        options: instance.options,
        storage: instance.storage,
        editor,
        manager: this,
      };

      const schemaSpec = instance.config.addSchema?.(ctx) || null;
      if (schemaSpec) {
        this.applySchemaSpec(schema, schemaSpec, instance.name);
      }

      const layoutHooks = instance.config.addLayout?.(ctx) || null;
      if (layoutHooks) {
        layout.byNodeName.set(instance.name, layoutHooks);
      }

      const canvasHooks = instance.config.addCanvas?.(ctx) || null;
      if (canvasHooks) {
        this.applyCanvasHooks(canvas, canvasHooks);
      }
    }

    canvas.nodeSelectionTypes = Array.from(new Set(canvas.nodeSelectionTypes));

    return {
      instances,
      schema,
      layout,
      canvas,
    };
  }

  resolveState(input: LumenResolvedStructure | LumenExtensionInstance[], editor: any = null): LumenResolvedState {
    const instances = Array.isArray(input) ? input : input.instances;
    const state = createResolvedState();

    for (const instance of instances) {
      const ctx: LumenExtensionContext = {
        name: instance.name,
        options: instance.options,
        storage: instance.storage,
        editor,
        manager: this,
      };

      const plugins = instance.config.addPlugins?.(ctx) || [];
      if (plugins.length) {
        state.plugins.push(...plugins);
      }

      const shortcuts = instance.config.addShortcuts?.(ctx);
      if (shortcuts && Object.keys(shortcuts).length) {
        state.shortcuts.push(shortcuts);
      }

      const inputRules = instance.config.addInputRules?.(ctx) || [];
      if (inputRules.length) {
        state.inputRules.push(...inputRules);
      }

      const commands = instance.config.addCommands?.(ctx);
      if (commands && Object.keys(commands).length) {
        state.commands = {
          ...state.commands,
          ...commands,
        };
      }

      const stateTransforms = instance.config.addStateTransforms?.(ctx);
      if (Array.isArray(stateTransforms) && stateTransforms.length) {
        state.stateTransforms.push(...stateTransforms.filter((transform) => typeof transform === "function"));
      } else if (typeof stateTransforms === "function") {
        state.stateTransforms.push(stateTransforms);
      }
    }

    return state;
  }

  resolve(editor: any = null): LumenResolvedExtensions {
    const structure = this.resolveStructure(editor);
    const state = this.resolveState(structure, editor);

    return {
      ...structure,
      state,
    };
  }

  private createInstances(editor: any = null) {
    const seenNames = new Set<string>();
    const instances: LumenExtensionInstance[] = [];

    for (const extension of this.extensions) {
      const { config } = extension;
      const name = String(config?.name || "").trim();
      if (!name) {
        throw new Error("Lumen extension name is required.");
      }
      if (seenNames.has(name)) {
        throw new Error(`Duplicate Lumen extension name: ${name}`);
      }
      seenNames.add(name);

      const options = config.addOptions ? config.addOptions() : {};
      const baseContext: LumenExtensionContext = {
        name,
        options,
        storage: undefined,
        editor,
        manager: this,
      };
      const storage = config.addStorage ? config.addStorage(baseContext) : {};

      instances.push({
        name,
        kind: config.kind || "extension",
        priority: Number.isFinite(config.priority) ? Number(config.priority) : 100,
        options,
        storage,
        config,
      });
    }

    instances.sort((a, b) => b.priority - a.priority);

    return instances;
  }

  private applySchemaSpec(
    target: LumenResolvedStructure["schema"],
    schemaSpec: LumenSchemaSpec,
    extensionName: string
  ) {
    for (const [name, spec] of Object.entries(schemaSpec.nodes || {})) {
      if (name in target.nodes) {
        throw new Error(`Duplicate Lumen schema node "${name}" from extension "${extensionName}"`);
      }
      target.nodes[name] = spec;
    }

    for (const [name, spec] of Object.entries(schemaSpec.marks || {})) {
      if (name in target.marks) {
        throw new Error(`Duplicate Lumen schema mark "${name}" from extension "${extensionName}"`);
      }
      target.marks[name] = spec;
    }
  }

  private applyCanvasHooks(target: LumenResolvedStructure["canvas"], canvasHooks: LumenCanvasHooks) {
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
