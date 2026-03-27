import { getExtensionField } from "./getExtensionField";
import { sortExtensions } from "./sortExtensions";
import { callOrReturn } from "../utilities/callOrReturn";
import type { AnyExtension, ClipboardSerializerLike, ExtensionContext } from "../types";

export const resolveClipboardSerializer = ({
  extensions,
  getContext,
  baseSerializer,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
  baseSerializer?: ClipboardSerializerLike | null;
}) => {
  for (const extension of sortExtensions(extensions)) {
    const ctx = getContext(extension);
    const serializer = callOrReturn(
      getExtensionField<ClipboardSerializerLike | (() => ClipboardSerializerLike | null)>(
        extension,
        "clipboardSerializer",
        ctx
      ),
      null
    );

    if (serializer != null) {
      return serializer;
    }
  }

  return baseSerializer ?? null;
};
