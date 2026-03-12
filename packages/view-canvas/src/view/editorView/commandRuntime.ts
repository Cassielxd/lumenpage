import { setupViewCommands } from "./commands";
import { warnLegacyCanvasConfigUsage } from "./legacyConfigWarnings";
import type { CanvasCommands } from "./types";

// 命令运行时初始化：整理 commands 配置并挂载到 view.commands。
export const createCommandRuntime = ({
  view,
  schema,
  resolveCanvasConfig,
  commandsFromProps,
}: {
  view: any;
  schema: any;
  resolveCanvasConfig: (key: string, fallback?: any) => any;
  commandsFromProps?: CanvasCommands | null;
}) => {
  const strictLegacy = resolveCanvasConfig("legacyPolicy", null)?.strict === true;
  const legacyCommands = resolveCanvasConfig("commands", {});
  const hasPropCommands = commandsFromProps && typeof commandsFromProps === "object";
  const commands = hasPropCommands ? commandsFromProps : legacyCommands;
  if (!hasPropCommands && legacyCommands && Object.keys(legacyCommands).length > 0) {
    warnLegacyCanvasConfigUsage(
      "commands",
      "EditorProps.handleKeyDown + keymap plugin + explicit commands wiring",
      strictLegacy
    );
  }
  const noopCommand = () => false;
  const runCommand =
    commands.runCommand ??
    ((command, state, dispatch) => (typeof command === "function" ? command(state, dispatch) : false));
  const basicCommands = {
    deleteSelection: commands.basicCommands?.deleteSelection ?? noopCommand,
    joinBackward: commands.basicCommands?.joinBackward ?? noopCommand,
    selectNodeBackward: commands.basicCommands?.selectNodeBackward ?? noopCommand,
    joinForward: commands.basicCommands?.joinForward ?? noopCommand,
    selectNodeForward: commands.basicCommands?.selectNodeForward ?? noopCommand,
    splitBlock: commands.basicCommands?.splitBlock ?? noopCommand,
    enter: commands.basicCommands?.enter ?? noopCommand,
    undo: commands.basicCommands?.undo ?? noopCommand,
    redo: commands.basicCommands?.redo ?? noopCommand,
  };
  const setBlockAlign = commands.setBlockAlign ?? (() => noopCommand);
  const keymap = commands.keymap ?? null;
  const enableBuiltInKeyFallback = commands.fallbackKeyHandling !== false;
  const keyAliasMap = {
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ArrowUp: "Up",
    ArrowDown: "Down",
    Escape: "Esc",
    Delete: "Del",
    " ": "Space",
  };

  // 将键盘事件格式化成 PM 风格按键描述（例如 Mod-z / Shift-Mod-z）。
  const resolveModifierPrefix = (event) => {
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

  // 统一键名中的修饰键顺序，兼容 Mod-Shift-z / Shift-Mod-z 等写法差异。
  const normalizeKeyBindingName = (name) => {
    if (typeof name !== "string" || name.trim().length === 0) {
      return "";
    }
    const parts = name.split("-").map((item) => item.trim()).filter(Boolean);
    if (parts.length === 0) {
      return "";
    }
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);
    const weight = { Shift: 1, Alt: 2, Mod: 3, Ctrl: 4, Meta: 5 };
    const normalizedModifiers = [...new Set(modifiers.map((mod) => {
      const lower = mod.toLowerCase();
      if (lower === "shift") return "Shift";
      if (lower === "alt") return "Alt";
      if (lower === "mod") return "Mod";
      if (lower === "ctrl" || lower === "control") return "Ctrl";
      if (lower === "meta" || lower === "cmd" || lower === "command") return "Meta";
      return mod;
    }))].sort((a, b) => (weight[a] ?? 99) - (weight[b] ?? 99) || a.localeCompare(b));
    return normalizedModifiers.length > 0
      ? `${normalizedModifiers.join("-")}-${key}`
      : key;
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

  const resolveKeyNames = (event) => {
    if (!event) {
      return [];
    }
    let key = event.key || "";
    if (!key) {
      return [];
    }
    const alias = keyAliasMap[key] ?? null;
    const primaryKey = key.length === 1 ? key.toLowerCase() : key;
    const aliasKey = alias ? (alias.length === 1 ? alias.toLowerCase() : alias) : null;
    const prefix = resolveModifierPrefix(event);
    const names = [];
    const pushName = (name) => {
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
    // 兼容某些配置写成全小写（例如 mod-arrowleft / mod-escape）。
    pushName(primaryKey.toLowerCase());
    if (aliasKey) {
      pushName(aliasKey.toLowerCase());
    }
    return names;
  };

  const runKeymap = (event) => {
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

  view.commands = setupViewCommands({
    view,
    schema,
    basicCommands,
    setBlockAlign,
    viewCommandConfig: commands.viewCommands,
    runCommand,
  });

  return {
    commands,
    runCommand,
    basicCommands,
    runKeymap,
    enableBuiltInKeyFallback,
  };
};
