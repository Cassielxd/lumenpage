import { setupViewCommands } from "./commands";
import { warnLegacyCanvasConfigUsage } from "./legacyConfigWarnings";
import type { CanvasCommandConfig } from "./types";

// 命令运行时初始化：整理 commands 配置并挂载到 view.commands。
export const createCommandRuntime = ({
  view,
  schema,
  resolveCanvasConfig,
  commandConfigFromProps,
}: {
  view: any;
  schema: any;
  resolveCanvasConfig: (key: string, fallback?: any) => any;
  commandConfigFromProps?: CanvasCommandConfig | null;
}) => {
  const strictLegacy = resolveCanvasConfig("legacyPolicy", null)?.strict === true;
  const legacyCommandConfig = resolveCanvasConfig("commands", {});
  const hasPropCommandConfig =
    commandConfigFromProps && typeof commandConfigFromProps === "object";
  const commandConfig = hasPropCommandConfig ? commandConfigFromProps : legacyCommandConfig;
  if (!hasPropCommandConfig && legacyCommandConfig && Object.keys(legacyCommandConfig).length > 0) {
    warnLegacyCanvasConfigUsage(
      "commands",
      "EditorProps.handleKeyDown + keymap plugin + explicit commands wiring",
      strictLegacy
    );
  }
  const noopCommand = () => false;
  const runCommand =
    commandConfig.runCommand ??
    ((command, state, dispatch) => (typeof command === "function" ? command(state, dispatch) : false));
  const basicCommands = {
    deleteSelection: commandConfig.basicCommands?.deleteSelection ?? noopCommand,
    joinBackward: commandConfig.basicCommands?.joinBackward ?? noopCommand,
    selectNodeBackward: commandConfig.basicCommands?.selectNodeBackward ?? noopCommand,
    joinForward: commandConfig.basicCommands?.joinForward ?? noopCommand,
    selectNodeForward: commandConfig.basicCommands?.selectNodeForward ?? noopCommand,
    splitBlock: commandConfig.basicCommands?.splitBlock ?? noopCommand,
    enter: commandConfig.basicCommands?.enter ?? noopCommand,
    undo: commandConfig.basicCommands?.undo ?? noopCommand,
    redo: commandConfig.basicCommands?.redo ?? noopCommand,
  };
  const setBlockAlign = commandConfig.setBlockAlign ?? (() => noopCommand);
  const keymap = commandConfig.keymap ?? null;
  const enableBuiltInKeyFallback = commandConfig.fallbackKeyHandling !== false;
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
    viewCommandConfig: commandConfig.viewCommands,
    runCommand,
  });

  return {
    commandConfig,
    runCommand,
    basicCommands,
    runKeymap,
    enableBuiltInKeyFallback,
  };
};
