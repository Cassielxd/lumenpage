/*
 * 文件说明：编辑器状态创建与事务应用。
 * 主要职责：根据 JSON/Doc/Text 初始化 EditorState，并应用事务更新。
 */

import { EditorState, TextSelection } from "prosemirror-state";


import { history } from "prosemirror-history";







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


  if (!schema) {
    throw new Error("schema is required to create editor state.");
  }

  if (!createDocFromText && !doc && !json) {
    throw new Error("createDocFromText is required when no doc/json is provided.");
  }

  let resolvedDoc = doc;


  if (!resolvedDoc) {


    resolvedDoc = json ? schema.nodeFromJSON(json) : createDocFromText ? createDocFromText(text) : doc;


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


