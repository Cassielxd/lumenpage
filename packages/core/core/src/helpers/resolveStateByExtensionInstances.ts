import { getExtensionField } from "./getExtensionField";
import { isExtensionRulesEnabled } from "./isExtensionRulesEnabled";
import { createResolvedState } from "./createResolvedState";
import { callOrReturn } from "../utilities/callOrReturn";
import type {
  CommandMap,
  EditorPlugin,
  EnableRules,
  ExtensionContext,
  ExtensionInstance,
  KeyboardShortcutMap,
  ResolvedState,
  StateExtender,
} from "../types";

export const resolveStateByExtensionInstances = ({
  instances,
  getContext,
  enableInputRules,
  enablePasteRules,
}: {
  instances: ExtensionInstance[];
  getContext: (instance: ExtensionInstance) => ExtensionContext;
  enableInputRules: EnableRules | undefined;
  enablePasteRules: EnableRules | undefined;
}): ResolvedState => {
  const state = createResolvedState();

  for (const instance of instances) {
    const ctx = getContext(instance);

    const plugins = callOrReturn(
      getExtensionField<() => EditorPlugin[]>(instance.extension, "addPlugins", ctx),
      []
    );

    if (plugins.length) {
      state.plugins.push(...plugins);
    }

    const keyboardShortcuts = callOrReturn(
      getExtensionField<() => KeyboardShortcutMap>(instance.extension, "addKeyboardShortcuts", ctx),
      {}
    );

    if (keyboardShortcuts && Object.keys(keyboardShortcuts).length) {
      state.keyboardShortcuts.push(keyboardShortcuts);
    }

    const inputRules = callOrReturn(
      getExtensionField<() => ResolvedState["inputRules"]>(instance.extension, "addInputRules", ctx),
      []
    );

    if (isExtensionRulesEnabled(instance.extension, enableInputRules) && inputRules.length) {
      state.inputRules.push(...inputRules);
    }

    const pasteRules = callOrReturn(
      getExtensionField<() => ResolvedState["pasteRules"]>(instance.extension, "addPasteRules", ctx),
      []
    );

    if (isExtensionRulesEnabled(instance.extension, enablePasteRules) && pasteRules.length) {
      state.pasteRules.push(...pasteRules);
    }

    const commands = callOrReturn(
      getExtensionField<() => CommandMap>(instance.extension, "addCommands", ctx),
      {}
    );

    if (commands && Object.keys(commands).length) {
      state.commands = {
        ...commands,
        ...state.commands,
      };
    }

    const stateExtenders = callOrReturn(
      getExtensionField<() => StateExtender[] | StateExtender | null>(instance.extension, "extendState", ctx),
      null
    );

    if (Array.isArray(stateExtenders) && stateExtenders.length) {
      state.stateExtenders.push(...stateExtenders.filter((transform) => typeof transform === "function"));
    } else if (typeof stateExtenders === "function") {
      state.stateExtenders.push(stateExtenders);
    }
  }

  return state;
};
