import type { LumenExtensionConfig } from "./types";

export class LumenExtension<Options = any, Storage = any> {
  config: LumenExtensionConfig<Options, Storage>;

  constructor(config: LumenExtensionConfig<Options, Storage>) {
    this.config = {
      kind: "extension",
      priority: 100,
      ...config,
    };
  }

  static create<Options = any, Storage = any>(config: LumenExtensionConfig<Options, Storage>) {
    return new LumenExtension(config);
  }
}
