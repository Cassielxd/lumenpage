import { getExtensionField } from "./getExtensionField.js";
import { sortExtensions } from "./sortExtensions.js";
import { callOrReturn } from "../utilities/callOrReturn.js";
import type { AnyExtension, ClipboardParserLike, ExtensionContext } from "../types.js";

export const resolveClipboardParser = ({
  extensions,
  getContext,
  baseParser,
}: {
  extensions: ReadonlyArray<AnyExtension>;
  getContext: (extension: AnyExtension) => ExtensionContext;
  baseParser?: ClipboardParserLike | null;
}) => {
  for (const extension of sortExtensions(extensions)) {
    const ctx = getContext(extension);
    const parser = callOrReturn(
      getExtensionField<ClipboardParserLike | (() => ClipboardParserLike | null)>(
        extension,
        "clipboardParser",
        ctx
      ),
      null
    );

    if (parser != null) {
      return parser;
    }
  }

  return baseParser ?? null;
};
