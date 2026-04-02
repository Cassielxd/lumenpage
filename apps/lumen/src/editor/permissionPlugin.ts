import { COMMENT_MUTATION_META } from "lumenpage-extension-comment";
import { Plugin } from "lumenpage-state";

export type PlaygroundPermissionMode = "full" | "comment" | "readonly";

// Filter document mutations at the integration layer without modifying editor core.
export const createPlaygroundPermissionPlugin = (
  mode: PlaygroundPermissionMode | (() => PlaygroundPermissionMode)
) => {
  const resolveMode =
    typeof mode === "function" ? (mode as () => PlaygroundPermissionMode) : () => mode;

  if (typeof mode !== "function" && mode === "full") {
    return null;
  }

  return new Plugin({
    filterTransaction(tr) {
      if (!tr) {
        return true;
      }
      if (!tr.docChanged) {
        return true;
      }

      const currentMode = resolveMode();
      if (currentMode === "full") {
        return true;
      }
      if (currentMode === "comment") {
        return tr.getMeta?.(COMMENT_MUTATION_META) === true;
      }
      return false;
    },
  });
};
