import type { Slice } from "lumenpage-model";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import { getExtensionField } from "./getExtensionField";
import { sortExtensions } from "./sortExtensions";
import type { AnyExtension, ClipboardTextParser, ExtensionContext } from "../types";

export const createClipboardTextParser = ({
  extensions,
  getContext,
  baseParser,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
  baseParser?: ClipboardTextParser;
}) => {
  const sortedExtensions = sortExtensions(extensions);

  return (text: string, context?: unknown, plain?: boolean, view?: CanvasEditorView | null): Slice | null | undefined => {
    for (const extension of sortedExtensions) {
      const ctx = getContext(extension);
      const parser = getExtensionField<
        (text: string, context?: unknown, plain?: boolean) => Slice | null | undefined
      >(extension, "clipboardTextParser", ctx);

      if (!parser) {
        continue;
      }

      const slice = parser(text, context, plain);

      if (slice != null) {
        return slice;
      }
    }

    return baseParser ? baseParser(text, context, plain, view) : null;
  };
};
