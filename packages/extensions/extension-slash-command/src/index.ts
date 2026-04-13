import { Extension } from "lumenpage-core";

import { createSlashCommandPlugin, type SlashCommandOptions } from "./slash-command.js";

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: "slashCommand",
  priority: 185,
  addOptions() {
    return {
      items: [],
      trigger: "/",
      maxItems: 10,
      emptyLabel: "",
    } as SlashCommandOptions;
  },
  addPlugins() {
    return this.editor ? [createSlashCommandPlugin(this.editor, this.options)] : [];
  },
});

export const SlashCommand = SlashCommandExtension;
export const createSlashExtension = (options: SlashCommandOptions) =>
  SlashCommandExtension.configure(options);

export {
  createSlashCommandPlugin,
  openSlashCommandPicker,
  slashCommandPluginKey,
  type SlashCommandItem,
  type SlashCommandItemSource,
  type SlashCommandCommandArgs,
  type SlashCommandRenderProps,
  type SlashCommandRenderLifecycle,
  type SlashCommandOptions,
} from "./slash-command.js";

export default SlashCommandExtension;
