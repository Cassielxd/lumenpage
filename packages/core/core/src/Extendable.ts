import { getExtensionField } from "./helpers/getExtensionField";
import { mergeDeep } from "./utilities/mergeDeep";
import type { AnyExtension, ExtendableConfig } from "./types";

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

export { getExtensionField } from "./helpers/getExtensionField";
export { mergeDeep } from "./utilities/mergeDeep";
