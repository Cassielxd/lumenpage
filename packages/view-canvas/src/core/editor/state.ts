import { EditorState, TextSelection } from "lumenpage-state";

import { createBlockIdPlugin, createBlockIdTransaction } from "./blockIdPlugin";

type CreateEditorStateOptions = {
  schema?: any;
  createDocFromText?: (text: string) => any;
  text?: string;
  doc?: any;
  json?: any;
  plugins?: any[];
  historyPlugin?: any;
  ensureBlockIds?: boolean;
};

export function createEditorState({
  schema,

  createDocFromText,

  text = "",

  doc = null,

  json = null,

  plugins = [],

  historyPlugin = null,

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

  const resolvedPlugins = [
    ...(historyPlugin ? [historyPlugin] : []),
    ...(ensureBlockIds ? [createBlockIdPlugin()] : []),
    ...plugins,
  ];

  const state = EditorState.create({
    schema,

    doc: resolvedDoc,

    selection,

    plugins: resolvedPlugins,
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
