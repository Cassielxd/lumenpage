import { Plugin, PluginKey } from "lumenpage-state";

import { Extension } from "../Extension";

export const focusEventsPluginKey = new PluginKey("focusEvents");

export const FocusEvents = Extension.create({
  name: "focusEvents",
  priority: 850,
  addPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: focusEventsPluginKey,
        props: {
          handleDOMEvents: {
            focus: (view, event: Event) => {
              if (!editor) {
                return false;
              }

              editor.isFocused = true;
              const transaction = editor.state?.tr
                ?.setMeta("focus", { event })
                ?.setMeta("addToHistory", false);
              if (transaction) {
                view.dispatch(transaction);
              }

              return false;
            },
            blur: (view, event: Event) => {
              if (!editor) {
                return false;
              }

              editor.isFocused = false;
              const transaction = editor.state?.tr
                ?.setMeta("blur", { event })
                ?.setMeta("addToHistory", false);
              if (transaction) {
                view.dispatch(transaction);
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});

export default FocusEvents;
