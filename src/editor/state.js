import { EditorState, TextSelection } from "prosemirror-state";
import { history } from "prosemirror-history";
import { schema, createDocFromText } from "./schema.js";

export function createEditorState({
  text = "",
  doc = null,
  json = null,
  plugins = [],
} = {}) {
  let resolvedDoc = doc;
  if (!resolvedDoc) {
    resolvedDoc = json ? schema.nodeFromJSON(json) : createDocFromText(text);
  }

  const selection = TextSelection.create(resolvedDoc, resolvedDoc.content.size);
  return EditorState.create({
    schema,
    doc: resolvedDoc,
    selection,
    plugins: [history(), ...plugins],
  });
}

export function applyTransaction(state, tr) {
  return state.apply(tr);
}
