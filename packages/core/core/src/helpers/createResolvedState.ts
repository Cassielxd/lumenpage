import type { ResolvedState } from "../types.js";

export const createResolvedState = (): ResolvedState => ({
  plugins: [],
  keyboardShortcuts: [],
  inputRules: [],
  pasteRules: [],
  commands: {},
  stateExtenders: [],
});
