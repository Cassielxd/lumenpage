export type EditorSessionMode = "edit" | "viewer";

export const normalizeEditorSessionMode = (value: unknown): EditorSessionMode =>
  value === "viewer" ? "viewer" : "edit";

export const toggleEditorSessionMode = (value: EditorSessionMode): EditorSessionMode =>
  value === "viewer" ? "edit" : "viewer";
