import type { CanvasEditorView } from "lumenpage-view-canvas";

import { getExtensionField } from "./getExtensionField.js";
import { sortExtensions } from "./sortExtensions.js";
import type { AnyExtension, ExtensionContext } from "../types.js";

export const createHtmlTransformPipeline = ({
  extensions,
  getContext,
  field,
  baseTransform,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
  field: "transformPastedHTML";
  baseTransform?: (html: string, view?: CanvasEditorView | null) => string;
}) =>
  sortExtensions(extensions).reduce(
    (transform, extension) => {
      const ctx = getContext(extension);
      const extensionTransform = getExtensionField<(html: string) => string | null | undefined>(
        extension,
        field,
        ctx
      );

      if (!extensionTransform) {
        return transform;
      }

      return (html: string, view?: CanvasEditorView | null) => {
        const transformedHtml = transform(html, view);
        return extensionTransform(transformedHtml) ?? transformedHtml;
      };
    },
    baseTransform || ((html: string) => html)
  );
