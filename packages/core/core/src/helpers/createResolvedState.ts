import type { ResolvedState } from "../types";

export const createResolvedState = (): ResolvedState => ({
  plugins: [],
  keyboardShortcuts: [],
  inputRules: [],
  pasteRules: [],
  commands: {},
  stateExtenders: [],
});
