import { LumenExtension } from "lumenpage-core";

import { createSelectionBubblePlugin, type SelectionBubblePluginOptions } from "./selectionBubble";

export const createLumenSelectionBubbleExtension = (options: SelectionBubblePluginOptions = {}) =>
  LumenExtension.create({
    name: "selection-bubble",
    priority: 170,
    addPlugins: () => [createSelectionBubblePlugin(options)],
  });

