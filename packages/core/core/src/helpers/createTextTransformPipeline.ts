import type { CanvasEditorView } from "lumenpage-view-canvas";

import { getExtensionField } from "./getExtensionField";
import { sortExtensions } from "./sortExtensions";
import type { AnyExtension, ExtensionContext } from "../types";

export const createTextTransformPipeline = ({
  extensions,
  getContext,
  field,
  baseTransform,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
  field: "transformPastedText";
  baseTransform?: (text: string, plain: boolean, view?: CanvasEditorView | null) => string;
}) =>
  sortExtensions(extensions).reduce(
    (transform, extension) => {
      const ctx = getContext(extension);
      const extensionTransform = getExtensionField<
        (text: string, plain: boolean) => string | null | undefined
      >(extension, field, ctx);

      if (!extensionTransform) {
        return transform;
      }

      return (text: string, plain: boolean, view?: CanvasEditorView | null) => {
        const transformedText = transform(text, plain, view);
        return extensionTransform(transformedText, plain) ?? transformedText;
      };
    },
    baseTransform || ((text: string) => text)
  );
