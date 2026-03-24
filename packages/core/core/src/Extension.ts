import type { ExtensionConfig } from "./types";
import { Extendable } from "./Extendable";

export class Extension<Options = any, Storage = any> extends Extendable<
  Options,
  Storage,
  ExtensionConfig<Options, Storage>
> {
  type = "extension" as const;

  static create<O = any, S = any>(
    config: Partial<ExtensionConfig<O, S>> | (() => Partial<ExtensionConfig<O, S>>) = {}
  ) {
    const resolvedConfig = typeof config === "function" ? config() : config;
    return new Extension<O, S>(resolvedConfig);
  }
}
