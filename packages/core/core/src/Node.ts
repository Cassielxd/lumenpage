import type { NodeConfig } from "./types";
import { Extendable } from "./Extendable";

export class Node<Options = any, Storage = any> extends Extendable<
  Options,
  Storage,
  NodeConfig<Options, Storage>
> {
  type = "node" as const;

  static create<O = any, S = any>(
    config: Partial<NodeConfig<O, S>> | (() => Partial<NodeConfig<O, S>>) = {}
  ) {
    const resolvedConfig = typeof config === "function" ? config() : config;
    return new Node<O, S>(resolvedConfig);
  }
}
