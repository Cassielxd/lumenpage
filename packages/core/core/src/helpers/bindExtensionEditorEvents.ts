import { getExtensionField } from "./getExtensionField";
import { sortExtensions } from "./sortExtensions";
import type { Editor } from "../Editor";
import type { AnyExtension, ExtensionContext } from "../types";

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
  extensions,
  getContext,
}: {
  editor: Editor;
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
}) => {
  for (const extension of sortExtensions(extensions)) {
    const ctx = getContext(extension);

    for (const [eventName, fieldName] of eventMap) {
      const handler = getExtensionField<(event: unknown) => void>(extension, fieldName, ctx);

      if (typeof handler === "function") {
        editor.on(eventName, handler);
      }
    }
  }
};
