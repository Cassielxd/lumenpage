import { Extension } from "lumenpage-core";

import { createSelectionBubblePlugin, type SelectionBubblePluginOptions } from "./selectionBubble";

export const SelectionBubbleExtension = Extension.create<SelectionBubblePluginOptions>({
  name: "selection-bubble",
  priority: 170,
  addOptions() {
    return {} as SelectionBubblePluginOptions;
  },
  addProseMirrorPlugins() {
    return [createSelectionBubblePlugin(this.options)];
  },
});

export const createSelectionBubbleExtension = (options: SelectionBubblePluginOptions = {}) =>
  SelectionBubbleExtension.configure(options);

export const SelectionBubble = SelectionBubbleExtension;

export {
  createSelectionBubblePlugin,
  type SelectionBubbleAction,
  type SelectionBubbleRenderProps,
  type SelectionBubbleRenderLifecycle,
  type SelectionBubblePluginOptions,
} from "./selectionBubble";
