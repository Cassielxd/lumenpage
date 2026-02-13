import { EditorState, TextSelection } from "lumenpage-state";

import { history } from "lumenpage-history";
import { createBlockIdPlugin, createBlockIdTransaction } from "./blockIdPlugin";

type CreateEditorStateOptions = {
  schema?: any;
  createDocFromText?: (text: string) => any;
  text?: string;
  doc?: any;
  json?: any;
  plugins?: any[];
  ensureBlockIds?: boolean;
};

export function createEditorState({
  schema,

  createDocFromText,

  text = "",

  doc = null,

  json = null,

  plugins = [],

  ensureBlockIds = true,
}: CreateEditorStateOptions = {}) {
  if (!schema) {
    throw new Error("schema is required to create editor state.");
  }

  if (!createDocFromText && !doc && !json) {
    throw new Error("createDocFromText is required when no doc/json is provided.");
  }

  let resolvedDoc = doc;

  if (!resolvedDoc) {
    resolvedDoc = json
      ? schema.nodeFromJSON(json)
      : createDocFromText
        ? createDocFromText(text)
        : doc;
  }

  const selection = TextSelection.create(resolvedDoc, resolvedDoc.content.size);

  const state = EditorState.create({
    schema,

    doc: resolvedDoc,

    selection,

    plugins: [history(), ...(ensureBlockIds ? [createBlockIdPlugin()] : []), ...plugins],
  });

  if (ensureBlockIds) {
    const tr = createBlockIdTransaction(state);
    if (tr) {
      return state.apply(tr);
    }
  }

  return state;
}

export function applyTransaction(state, tr) {
  return state.apply(tr);
}
