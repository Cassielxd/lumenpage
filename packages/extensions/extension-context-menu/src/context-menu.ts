import { Extension } from "lumenpage-core";

import { ContextMenuPlugin, type ContextMenuPluginProps } from "./context-menu-plugin.js";

export type ContextMenuOptions = Omit<ContextMenuPluginProps, "editor">;

export const ContextMenu = Extension.create<ContextMenuOptions>({
  name: "contextMenu",
  priority: 172,
  addOptions() {
    return {
      element: null,
      items: [],
      render: null,
      pluginKey: "contextMenu",
      appendTo: undefined,
      shouldShow: null,
      options: undefined,
      className: undefined,
    } as ContextMenuOptions;
  },
  addPlugins() {
    if (!this.editor) {
      return [];
    }

    return [
      ContextMenuPlugin({
        ...this.options,
        editor: this.editor,
      }),
    ];
  },
});

export default ContextMenu;
