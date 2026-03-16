const keyAliasMap: Record<string, string> = {
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Escape: "Esc",
  Delete: "Del",
  " ": "Space",
};

export const createKeymapRunner = ({
  keymap,
  runCommand,
  view,
}: {
  keymap: Record<string, any> | null;
  runCommand: any;
  view: any;
}) => {
  const resolveModifierPrefix = (event: any) => {
    const modifiers = [];
    const platform = typeof navigator !== "undefined" ? navigator.platform || "" : "";
    const isMac = /Mac|iPhone|iPad|iPod/i.test(platform);

    if (event.shiftKey) {
      modifiers.push("Shift");
    }
    if (event.altKey) {
      modifiers.push("Alt");
    }

    if (event.ctrlKey && !isMac) {
      modifiers.push("Mod");
    } else if (event.metaKey && isMac) {
      modifiers.push("Mod");
    } else {
      if (event.ctrlKey) {
        modifiers.push("Ctrl");
      }
      if (event.metaKey) {
        modifiers.push("Meta");
      }
    }
    return modifiers.length > 0 ? `${modifiers.join("-")}-` : "";
  };

  const normalizeKeyBindingName = (name: string) => {
    if (typeof name !== "string" || name.trim().length === 0) {
      return "";
    }
    const parts = name
      .split("-")
      .map((item) => item.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      return "";
    }
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);
    const weight: Record<string, number> = { Shift: 1, Alt: 2, Mod: 3, Ctrl: 4, Meta: 5 };
    const normalizedModifiers = [
      ...new Set(
        modifiers.map((mod) => {
          const lower = mod.toLowerCase();
          if (lower === "shift") return "Shift";
          if (lower === "alt") return "Alt";
          if (lower === "mod") return "Mod";
          if (lower === "ctrl" || lower === "control") return "Ctrl";
          if (lower === "meta" || lower === "cmd" || lower === "command") return "Meta";
          return mod;
        })
      ),
    ].sort((a, b) => (weight[a] ?? 99) - (weight[b] ?? 99) || a.localeCompare(b));
    return normalizedModifiers.length > 0 ? `${normalizedModifiers.join("-")}-${key}` : key;
  };

  const normalizedKeymap = (() => {
    if (!keymap || typeof keymap !== "object") {
      return null;
    }
    const map = new Map();
    for (const [name, command] of Object.entries(keymap)) {
      const normalized = normalizeKeyBindingName(name);
      if (!normalized) {
        continue;
      }
      map.set(normalized, command);
    }
    return map;
  })();

  const resolveKeyNames = (event: any) => {
    if (!event) {
      return [];
    }
    const key = event.key || "";
    if (!key) {
      return [];
    }
    const alias = keyAliasMap[key] ?? null;
    const primaryKey = key.length === 1 ? key.toLowerCase() : key;
    const aliasKey = alias ? (alias.length === 1 ? alias.toLowerCase() : alias) : null;
    const prefix = resolveModifierPrefix(event);
    const names: string[] = [];
    const pushName = (name: string | null) => {
      if (!name) {
        return;
      }
      const candidate = `${prefix}${name}`;
      if (!names.includes(candidate)) {
        names.push(candidate);
      }
    };
    pushName(primaryKey);
    pushName(aliasKey);
    pushName(primaryKey.toLowerCase());
    if (aliasKey) {
      pushName(aliasKey.toLowerCase());
    }
    return names;
  };

  const runKeymap = (event: any) => {
    if (!keymap || typeof keymap !== "object") {
      return false;
    }
    const keyNames = resolveKeyNames(event);
    if (keyNames.length === 0) {
      return false;
    }
    for (const keyName of keyNames) {
      const direct = keymap[keyName] ?? null;
      const normalized = normalizeKeyBindingName(keyName);
      const command = direct ?? normalizedKeymap?.get(normalized) ?? null;
      if (typeof command !== "function") {
        continue;
      }
      return runCommand(command, view.state, view.dispatch.bind(view), view);
    }
    return false;
  };

  return {
    runKeymap,
  };
};
