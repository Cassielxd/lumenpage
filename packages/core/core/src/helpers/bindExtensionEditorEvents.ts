import { getExtensionField } from "./getExtensionField";
import { sortExtensions } from "./sortExtensions";
import type { Editor } from "../Editor";
import type { ExtensionContext, ExtensionInstance } from "../types";

const eventMap = [
  ["mount", "onMount"],
  ["unmount", "onUnmount"],
  ["beforeCreate", "onBeforeCreate"],
  ["create", "onCreate"],
  ["beforeTransaction", "onBeforeTransaction"],
  ["update", "onUpdate"],
  ["selectionUpdate", "onSelectionUpdate"],
  ["transaction", "onTransaction"],
  ["focus", "onFocus"],
  ["blur", "onBlur"],
  ["paste", "onPaste"],
  ["drop", "onDrop"],
  ["destroy", "onDestroy"],
] as const;

export const bindExtensionEditorEvents = ({
  editor,
  instances,
  getContext,
}: {
  editor: Editor;
  instances: ReadonlyArray<ExtensionInstance>;
  getContext: (instance: ExtensionInstance) => ExtensionContext;
}) => {
  for (const instance of sortExtensions(instances)) {
    const ctx = getContext(instance);

    for (const [eventName, fieldName] of eventMap) {
      const handler = getExtensionField<(event: unknown) => void>(instance.extension, fieldName, ctx);

      if (typeof handler === "function") {
        editor.on(eventName, handler);
      }
    }
  }
};
