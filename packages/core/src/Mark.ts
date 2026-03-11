import type { MarkConfig } from "./types";
import { Extendable } from "./Extendable";

export class Mark<Options = any, Storage = any> extends Extendable<
  Options,
  Storage,
  MarkConfig<Options, Storage>
> {
  type = "mark" as const;

  static create<O = any, S = any>(
    config: Partial<MarkConfig<O, S>> | (() => Partial<MarkConfig<O, S>>) = {}
  ) {
    const resolvedConfig = typeof config === "function" ? config() : config;
    return new Mark<O, S>(resolvedConfig);
  }
}
