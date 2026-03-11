import { Extension } from "lumenpage-core";

import {
  createActiveBlockSelectionPlugin,
  type ActiveBlockPluginOptions,
} from "./activeBlock";

export type ActiveBlockExtensionOptions = ActiveBlockPluginOptions;

export const ActiveBlockSelectionExtension = Extension.create<ActiveBlockExtensionOptions>({
  name: "active-block-selection",
  priority: 160,
  addOptions() {
    return {};
  },
  addProseMirrorPlugins() {
    return [createActiveBlockSelectionPlugin(this.options)];
  },
});

export const createActiveBlockSelectionExtension = (
  options: ActiveBlockExtensionOptions = {}
) => ActiveBlockSelectionExtension.configure(options);

export const ActiveBlock = ActiveBlockSelectionExtension;

export { createActiveBlockSelectionPlugin } from "./activeBlock";
