import { LumenExtension } from "lumenpage-core";

import { createActiveBlockSelectionPlugin } from "./activeBlock";

type ActiveBlockExtensionOptions = {
  includeTypes?: string[];
  excludeTypes?: string[];
  borderColor?: string;
  borderWidth?: number;
};

export const createLumenActiveBlockSelectionExtension = (
  options: ActiveBlockExtensionOptions = {}
) =>
  LumenExtension.create({
    name: "active-block-selection",
    priority: 160,
    addPlugins: () => [createActiveBlockSelectionPlugin(options)],
  });
