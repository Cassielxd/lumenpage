/*
 * 文件说明：编辑器状态创建与事务应用。
 * 主要职责：根据 JSON/Doc/Text 初始化 EditorState，并应用事务更新。
 */

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
