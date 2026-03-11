import { Extension } from "lumenpage-core";
import { ellipsis, emDash, smartQuotes } from "lumenpage-inputrules";

export type InputRulesOptions = {
  rules?: any[];
};

export const SmartInputRules = Extension.create<InputRulesOptions>({
  name: "smartInputRules",
  priority: 700,
  addOptions() {
    return {
      rules: [],
    };
  },
  addInputRules() {
    const defaultRules = [ellipsis, emDash, ...smartQuotes].filter(Boolean);
    return Array.isArray(this.options.rules) && this.options.rules.length > 0
      ? this.options.rules
      : defaultRules;
  },
});

export const createInputRulesExtension = (options: InputRulesOptions = {}) =>
  SmartInputRules.configure(options);

export const InputRules = SmartInputRules;

export default SmartInputRules;
