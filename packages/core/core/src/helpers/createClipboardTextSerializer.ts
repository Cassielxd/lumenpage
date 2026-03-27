import type { Slice } from "lumenpage-model";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import { getExtensionField } from "./getExtensionField";
import { sortExtensions } from "./sortExtensions";
import type { AnyExtension, ClipboardTextSerializer, ExtensionContext } from "../types";

export const createClipboardTextSerializer = ({
  extensions,
  getContext,
  baseSerializer,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
  baseSerializer?: ClipboardTextSerializer;
}) => {
  const sortedExtensions = sortExtensions(extensions);

  return (slice: Slice, view?: CanvasEditorView | null) => {
    for (const extension of sortedExtensions) {
      const ctx = getContext(extension);
      const serializer = getExtensionField<(slice: Slice) => string | null | undefined>(
        extension,
        "clipboardTextSerializer",
        ctx
      );

      if (!serializer) {
        continue;
      }

      const text = serializer(slice);

      if (text != null) {
        return text;
      }
    }

    return baseSerializer ? baseSerializer(slice, view) : null;
  };
};
