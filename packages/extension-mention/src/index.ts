import { Extension } from "lumenpage-core";

import { createMentionPlugin, type MentionPluginOptions } from "./mention";

export const MentionExtension = Extension.create<MentionPluginOptions>({
  name: "mention",
  priority: 180,
  addOptions() {
    return {} as MentionPluginOptions;
  },
  addProseMirrorPlugins() {
    return [createMentionPlugin(this.options)];
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
} from "./mention";
