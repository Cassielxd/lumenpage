export type EditorShortcutBinding = string | readonly string[];

const isMacPlatform = () => {
  if (typeof navigator === "undefined") {
    return false;
  }
  const platform = navigator.platform || navigator.userAgent || "";
  return /Mac|iPhone|iPad|iPod/i.test(platform);
};

const normalizeShortcutBinding = (binding: string) => {
  if (typeof binding !== "string" || binding.trim().length === 0) {
    return "";
  }

  const parts = binding
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  const key = parts[parts.length - 1];
  const weight: Record<string, number> = {
    Shift: 1,
    Alt: 2,
    Mod: 3,
    Ctrl: 4,
    Meta: 5,
  };
  const modifiers = [
    ...new Set(
      parts.slice(0, -1).map((modifier) => {
        const lower = modifier.toLowerCase();
        if (lower === "shift") return "Shift";
        if (lower === "alt" || lower === "option") return "Alt";
        if (lower === "mod") return "Mod";
        if (lower === "ctrl" || lower === "control") return "Ctrl";
        if (lower === "meta" || lower === "cmd" || lower === "command") return "Meta";
        return modifier;
      })
    ),
  ].sort((left, right) => (weight[left] ?? 99) - (weight[right] ?? 99) || left.localeCompare(right));

  return modifiers.length > 0 ? `${modifiers.join("-")}-${key}` : key;
};

const keyLabelMap: Record<string, string> = {
  Enter: "Enter",
  Tab: "Tab",
  Delete: "Delete",
  Backspace: "Backspace",
  Escape: "Esc",
  " ": "Space",
  Space: "Space",
};

export const EDITOR_SHORTCUTS = {
  save: ["Mod-s"] as const,
  undo: ["Mod-z"] as const,
  redo: ["Mod-y", "Shift-Mod-z"] as const,
  selectAll: ["Mod-a"] as const,
  toggleBold: ["Mod-b"] as const,
  toggleItalic: ["Mod-i"] as const,
  toggleUnderline: ["Mod-u"] as const,
  toggleStrike: ["Shift-Mod-s"] as const,
  toggleInlineCode: ["Mod-e"] as const,
  toggleBlockquote: ["Shift-Mod-b"] as const,
  toggleOrderedList: ["Shift-Mod-7"] as const,
  toggleBulletList: ["Shift-Mod-8"] as const,
  toggleHeading1: ["Alt-Mod-1"] as const,
  toggleHeading2: ["Alt-Mod-2"] as const,
  toggleHeading3: ["Alt-Mod-3"] as const,
  openLinkAtSelection: ["Mod-Enter"] as const,
  nextTableCell: ["Tab"] as const,
  previousTableCell: ["Shift-Tab"] as const,
} as const;

export const getPrimaryShortcutBinding = (binding: EditorShortcutBinding | null | undefined) => {
  const bindings = Array.isArray(binding) ? binding : binding ? [binding] : [];
  if (bindings.length === 0) {
    return "";
  }

  const normalizedBindings = bindings.map((value) => ({
    raw: value,
    normalized: normalizeShortcutBinding(value),
  }));

  if (isMacPlatform()) {
    return (
      normalizedBindings.find((entry) => entry.normalized === "Shift-Mod-z")?.raw ||
      normalizedBindings[0]?.raw ||
      ""
    );
  }

  return (
    normalizedBindings.find((entry) => entry.normalized === "Mod-y")?.raw ||
    normalizedBindings[0]?.raw ||
    ""
  );
};

export const formatShortcutLabel = (binding: string) => {
  const normalized = normalizeShortcutBinding(binding);
  if (!normalized) {
    return "";
  }

  const parts = normalized.split("-");
  const key = parts[parts.length - 1];
  const modifiers = parts
    .slice(0, -1)
    .sort(
      (left, right) =>
        ({ Mod: 1, Ctrl: 2, Meta: 3, Shift: 4, Alt: 5 }[left] ?? 99) -
          ({ Mod: 1, Ctrl: 2, Meta: 3, Shift: 4, Alt: 5 }[right] ?? 99) ||
        left.localeCompare(right)
    );
  const labels = modifiers.map((modifier) => {
    if (modifier === "Mod") {
      return isMacPlatform() ? "Cmd" : "Ctrl";
    }
    if (modifier === "Meta") {
      return "Cmd";
    }
    if (modifier === "Alt") {
      return isMacPlatform() ? "Option" : "Alt";
    }
    return modifier;
  });

  const keyLabel = keyLabelMap[key] || (key.length === 1 ? key.toUpperCase() : key);
  return [...labels, keyLabel].join("+");
};

export const getShortcutDisplayLabel = (binding: EditorShortcutBinding | null | undefined) => {
  const primary = getPrimaryShortcutBinding(binding);
  return primary ? formatShortcutLabel(primary) : "";
};
