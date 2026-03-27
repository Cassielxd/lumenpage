import { Selection } from "lumenpage-state";

import { createDocument, type EditorContent } from "../helpers/createDocument";
import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    setContent: {
      setContent: (content: EditorContent) => ReturnType;
    };
  }
}

export const setContent: RawCommands["setContent"] = (content: EditorContent) => ({
  editor,
  tr,
  dispatch,
}) => {
  if (!editor.schema) {
    return false;
  }

  const nextDoc = createDocument({
    content,
    schema: editor.schema,
  });

  tr.replaceWith(0, tr.doc.content.size, nextDoc.content);

  if (dispatch) {
    tr.setSelection(Selection.atEnd(tr.doc));
  }

  return true;
};
