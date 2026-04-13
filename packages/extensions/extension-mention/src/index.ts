import { Extension } from "lumenpage-core";

import { createMentionPlugin, type MentionPluginOptions } from "./mention.js";

export const MentionExtension = Extension.create<MentionPluginOptions>({
  name: "mention",
  priority: 180,
  addOptions() {
    return {
      items: [],
      trigger: "@",
      maxItems: 8,
      appendSpace: true,
      emptyLabel: "",
    } as MentionPluginOptions;
  },
  addPlugins() {
    return this.editor ? [createMentionPlugin(this.editor, this.options)] : [];
  },
});

export const createMentionExtension = (options: MentionPluginOptions) =>
  MentionExtension.configure(options);

export const Mention = MentionExtension;

export {
  createMentionPlugin,
  openMentionPicker,
  mentionPluginKey,
  type MentionItem,
  type MentionRenderProps,
  type MentionRenderLifecycle,
  type MentionPluginOptions,
} from "./mention.js";
