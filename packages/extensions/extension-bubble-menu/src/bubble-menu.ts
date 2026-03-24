import { Extension } from "lumenpage-core";

import { BubbleMenuPlugin, type BubbleMenuPluginProps } from "./bubble-menu-plugin";

export type BubbleMenuOptions = Omit<BubbleMenuPluginProps, "editor">;

export const BubbleMenu = Extension.create<BubbleMenuOptions>({
  name: "bubbleMenu",
  priority: 170,
  addOptions() {
    return {
      element: null,
      pluginKey: "bubbleMenu",
      updateDelay: 250,
      resizeDelay: 60,
      appendTo: undefined,
      shouldShow: null,
      options: undefined,
    } as BubbleMenuOptions;
  },
  addPlugins() {
    if (!this.editor) {
      return [];
    }

    return [
      BubbleMenuPlugin({
        ...this.options,
        editor: this.editor,
      }),
    ];
  },
});

export default BubbleMenu;
