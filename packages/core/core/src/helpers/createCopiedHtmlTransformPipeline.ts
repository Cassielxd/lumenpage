import type { Slice } from "lumenpage-model";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import { getExtensionField } from "./getExtensionField";
import { sortExtensions } from "./sortExtensions";
import type { AnyExtension, ExtensionContext } from "../types";

export const createCopiedHtmlTransformPipeline = ({
  extensions,
  getContext,
  baseTransform,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
  baseTransform?: (html: string, slice?: Slice, view?: CanvasEditorView | null) => string;
}) =>
  sortExtensions(extensions).reduce(
    (transform, extension) => {
      const ctx = getContext(extension);
      const extensionTransform = getExtensionField<
        (html: string, slice?: Slice) => string | null | undefined
      >(extension, "transformCopiedHTML", ctx);

      if (!extensionTransform) {
        return transform;
      }

      return (html: string, slice?: Slice, view?: CanvasEditorView | null) => {
        const transformedHtml = transform(html, slice, view);
        return extensionTransform(transformedHtml, slice) ?? transformedHtml;
      };
    },
    baseTransform || ((html: string) => html)
  );
