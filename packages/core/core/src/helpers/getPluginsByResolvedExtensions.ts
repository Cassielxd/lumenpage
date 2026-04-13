import { inputRules } from "lumenpage-inputrules";
import { keymap } from "lumenpage-keymap";

import { pasteRulesPlugin } from "../PasteRule.js";
import type { Editor } from "../Editor.js";
import type { EditorPlugin, ResolvedExtensions } from "../types.js";

export const getPluginsByResolvedExtensions = ({
  editor,
  resolved,
}: {
  editor: Editor;
  resolved: ResolvedExtensions;
}): EditorPlugin[] => {
  const plugins: EditorPlugin[] = [...resolved.state.plugins];

  plugins.push(
    ...resolved.state.keyboardShortcuts
      .filter((shortcuts) => shortcuts && Object.keys(shortcuts).length > 0)
      .map((shortcuts) => keymap(shortcuts))
  );

  const inputRuleSet = resolved.state.inputRules.filter(Boolean);

  if (inputRuleSet.length) {
    plugins.push(inputRules({ rules: inputRuleSet }));
  }

  const pasteRuleSet = resolved.state.pasteRules.filter(Boolean);

  if (pasteRuleSet.length) {
    plugins.push(...pasteRulesPlugin({ editor, rules: pasteRuleSet }));
  }

  return plugins;
};
