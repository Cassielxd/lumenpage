import { BeforeInput, Commands, Drop, FocusEvents, Keymap, Paste } from "./extensions";
import type { AnyExtensionInput, EnableRules } from "./types";

const EXTENSION_TYPES = new Set(["extension", "node", "mark"]);

const isCoreExtensionEnabled = (extension: AnyExtensionInput, enabled: EnableRules | undefined) => {
  if (Array.isArray(enabled)) {
    return enabled.some((entry) => {
      const name = typeof entry === "string" ? entry : entry?.name;
      return name === (extension as { name?: string })?.name;
    });
  }

  return enabled !== false;
};

const normalizeExtensionInput = (
  extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput
): AnyExtensionInput[] => {
  if (Array.isArray(extensions)) {
    return [...extensions];
  }

  return extensions ? [extensions] : [];
};

export const resolveEditorExtensions = ({
  extensions,
  enableCoreExtensions,
}: {
  extensions: ReadonlyArray<AnyExtensionInput> | AnyExtensionInput;
  enableCoreExtensions?: EnableRules;
}) => {
  const coreExtensions = [Commands, FocusEvents, BeforeInput, Paste, Drop, Keymap].filter(
    (extension) => isCoreExtensionEnabled(extension, enableCoreExtensions)
  );

  return [...coreExtensions, ...normalizeExtensionInput(extensions)].filter((extension) =>
    EXTENSION_TYPES.has((extension as { type?: string })?.type || "")
  );
};
