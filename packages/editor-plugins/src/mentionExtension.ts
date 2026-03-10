import { LumenExtension } from "lumenpage-core";

import { createMentionPlugin, type MentionPluginOptions } from "./mention";

export const createLumenMentionExtension = (options: MentionPluginOptions) =>
  LumenExtension.create({
    name: "mention",
    priority: 180,
    addPlugins: () => [createMentionPlugin(options)],
  });

