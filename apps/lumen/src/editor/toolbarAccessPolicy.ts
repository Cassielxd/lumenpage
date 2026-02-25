import type { EditorSessionMode } from "./sessionMode";

const VIEWER_ALLOWED_ACTIONS = new Set([
  "viewer",
  "print",
  "page-preview",
  "export-image",
  "export-pdf",
  "export-text",
  "export-html",
  "export-word",
  "share",
  "embed",
]);

export const canUseToolbarActionInSession = (mode: EditorSessionMode, action: string) =>
  mode === "edit" || VIEWER_ALLOWED_ACTIONS.has(action);
