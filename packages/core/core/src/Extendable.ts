import type { AnyExtension, ExtendableConfig } from "./types";

const isPlainObject = (value: unknown): value is Record<string, any> => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const mergeDeep = <T>(base: T, patch: any): T => {
  if (patch == null) {
    return base;
  }
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch as T;
  }

  const result: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    result[key] = isPlainObject(current) && isPlainObject(value) ? mergeDeep(current, value) : value;
  }
  return result as T;
};

export const getExtensionField = <Value = any>(
  extension: AnyExtension | null | undefined,
  field: string,
  context: Record<string, any> = {}
): Value | undefined => {
  if (!extension) {
    return undefined;
  }

  const localValue = (extension.config as Record<string, any>)[field];
  const parentValue = extension.parent ? getExtensionField(extension.parent, field, context) : undefined;

  if (localValue === undefined) {
    return parentValue as Value | undefined;
  }

  if (typeof localValue !== "function") {
    return localValue as Value;
  }

  const bound = (...args: any[]) =>
    localValue.apply(
      {
        ...context,
        name: extension.name,
        parent: parentValue,
      },
      args
    );

  return bound as Value;
};

export class Extendable<
  Options = any,
  Storage = any,
  Config extends ExtendableConfig<Options, Storage, any> = ExtendableConfig<Options, Storage, any>,
> {
  type: "extension" | "node" | "mark" = "extension";

  readonly name: string;
  readonly parent: AnyExtension | null;
  readonly config: Partial<Config>;
  readonly options: Partial<Options>;

  constructor(config: Partial<Config> = {}, parent: AnyExtension | null = null, options: Partial<Options> = {}) {
    const resolvedName = String(config.name ?? parent?.name ?? "").trim();
    if (!resolvedName) {
      throw new Error("Extension name is required.");
    }

    this.name = resolvedName;
    this.parent = parent;
    this.config = {
      priority: parent?.priority ?? 100,
      ...config,
      name: resolvedName,
    };
    this.options = options;
  }

  get priority() {
    return Number.isFinite(this.config.priority) ? Number(this.config.priority) : this.parent?.priority ?? 100;
  }

  configure(options: Partial<Options> = {}): this {
    const Constructor = this.constructor as new (
      config: Partial<Config>,
      parent: AnyExtension | null,
      nextOptions: Partial<Options>
    ) => this;

    return new Constructor(this.config, this.parent, mergeDeep(this.options, options));
  }

  extend(extendedConfig: Partial<Config> = {}): this {
    const Constructor = this.constructor as new (
      config: Partial<Config>,
      parent: AnyExtension | null,
      nextOptions: Partial<Options>
    ) => this;

    return new Constructor(
      mergeDeep(this.config as Record<string, any>, extendedConfig as Record<string, any>) as Partial<Config>,
      this,
      this.options
    );
  }
}
