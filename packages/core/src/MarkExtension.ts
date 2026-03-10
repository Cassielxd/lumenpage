import { LumenExtension } from "./Extension";
import type { LumenExtensionConfig } from "./types";

export class LumenMarkExtension<Options = any, Storage = any> extends LumenExtension<Options, Storage> {
  constructor(config: LumenExtensionConfig<Options, Storage>) {
    super({
      kind: "mark",
      ...config,
    });
  }

  static create<Options = any, Storage = any>(config: LumenExtensionConfig<Options, Storage>) {
    return new LumenMarkExtension(config);
  }
}
