import { EditorState, TextSelection } from "lumenpage-state";

type CreateEditorStateOptions = {
  schema?: any;
  createDocFromText?: (text: string) => any;
  text?: string;
  doc?: any;
  json?: any;
  plugins?: any[];
};

export function createEditorState({
  schema,

  createDocFromText,

  text = "",

  doc = null,

  json = null,

  plugins = [],
}: CreateEditorStateOptions = {}) {
  const legacyOptions = arguments[0] as Record<string, any> | undefined;
  if (legacyOptions && "historyPlugin" in legacyOptions) {
    throw new Error(
      "historyPlugin option has been removed. Pass history() through plugins explicitly."
    );
  }
  if (legacyOptions && "ensureBlockIds" in legacyOptions) {
    throw new Error(
      "ensureBlockIds option has been removed. Add createBlockIdPlugin() and an explicit init transaction."
    );
  }

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

    plugins,
  });

  return state;
}

export function applyTransaction(state, tr) {
  return state.apply(tr);
}
