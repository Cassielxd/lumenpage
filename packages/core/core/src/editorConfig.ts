import type { ResolvedStructure } from "./types.js";
import type { EditorOptions } from "./Editor.js";

export const defaultEditorOptions: EditorOptions = {
  extensions: [],
  element: null,
  content: "",
  enableCoreExtensions: true,
  editorProps: {},
  enableInputRules: true,
  enablePasteRules: true,
  autofocus: false,
  editable: true,
  onBeforeCreate: null,
  onMount: null,
  onUnmount: null,
  onCreate: null,
  onBeforeTransaction: null,
  onUpdate: null,
  onSelectionUpdate: null,
  onTransaction: null,
  onFocus: null,
  onBlur: null,
  onPaste: null,
  onDrop: null,
  onDestroy: null,
};

export const hasSchemaSpec = (resolved: ResolvedStructure) =>
  Object.keys(resolved.schema.nodes).length > 0 || Object.keys(resolved.schema.marks).length > 0;
