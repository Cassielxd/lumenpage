import type { Slice } from "lumenpage-model";
import type { CanvasEditorView } from "lumenpage-view-canvas";

import { getExtensionField } from "./getExtensionField.js";
import { sortExtensions } from "./sortExtensions.js";
import type { AnyExtension, ExtensionContext } from "../types.js";

export const createSliceTransformPipeline = ({
  extensions,
  getContext,
  field,
  baseTransform,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
  field: "transformPasted" | "transformCopied";
  baseTransform?: (slice: Slice, view?: CanvasEditorView | null) => Slice;
}) =>
  sortExtensions(extensions).reduce(
    (transform, extension) => {
      const ctx = getContext(extension);
      const extensionTransform = getExtensionField<(slice: Slice) => Slice | null | undefined>(
        extension,
        field,
        ctx
      );

      if (!extensionTransform) {
        return transform;
      }

      return (slice: Slice, view?: CanvasEditorView | null) => {
        const transformedSlice = transform(slice, view);
        return extensionTransform(transformedSlice) ?? transformedSlice;
      };
    },
    baseTransform || ((slice: Slice) => slice)
  );
