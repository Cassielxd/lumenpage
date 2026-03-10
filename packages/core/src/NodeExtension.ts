import { LumenExtension } from "./Extension";
import type { LumenExtensionConfig } from "./types";

export class LumenNodeExtension<Options = any, Storage = any> extends LumenExtension<Options, Storage> {
  constructor(config: LumenExtensionConfig<Options, Storage>) {
    super({
      kind: "node",
      ...config,
    });
  }

  static create<Options = any, Storage = any>(config: LumenExtensionConfig<Options, Storage>) {
    return new LumenNodeExtension(config);
  }
}
