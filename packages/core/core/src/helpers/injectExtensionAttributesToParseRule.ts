import type { ParseRule } from "lumenpage-model";

import type {
  AttributeConfigs,
  HTMLAttributes,
  ParseHTMLSource,
  UnknownRecord,
} from "../types";

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isStyleRule = (rule: ParseRule): rule is Extract<ParseRule, { style: string }> =>
  typeof (rule as { style?: unknown }).style === "string";

const getParsedAttributes = (
  attributeConfigs: AttributeConfigs | null,
  source: ParseHTMLSource
): HTMLAttributes | null => {
  if (!attributeConfigs) {
    return null;
  }

  const attrs: HTMLAttributes = {};

  for (const [name, config] of Object.entries(attributeConfigs)) {
    if (typeof config?.parseHTML !== "function") {
      continue;
    }

    const value = config.parseHTML(source);

    if (value !== undefined) {
      attrs[name] = value;
    }
  }

  return Object.keys(attrs).length > 0 ? attrs : null;
};

export const injectExtensionAttributesToParseRule = <Rule extends ParseRule>(
  rule: Rule,
  attributeConfigs: AttributeConfigs | null
): Rule => {
  if (!rule || typeof rule !== "object") {
    return rule;
  }

  const staticAttrs = isRecord(rule.attrs) ? rule.attrs : null;
  const originalGetAttrs =
    typeof rule.getAttrs === "function"
      ? (rule.getAttrs as (value: string | HTMLElement) => unknown)
      : null;

  if (!originalGetAttrs && !staticAttrs && !attributeConfigs) {
    return rule;
  }

  const nextRule = { ...rule } as Rule;
  const mutableRule = nextRule as unknown as UnknownRecord;
  delete mutableRule.attrs;
  mutableRule.getAttrs = (rawValue: string | HTMLElement) => {
    const parsedAttrs = isStyleRule(rule)
      ? null
      : getParsedAttributes(attributeConfigs, rawValue as ParseHTMLSource);
    const ruleAttrs = originalGetAttrs
      ? isStyleRule(rule)
        ? originalGetAttrs(rawValue as string)
        : originalGetAttrs(rawValue as HTMLElement)
      : staticAttrs;

    if (ruleAttrs === false) {
      return false;
    }

    const mergedAttrs: HTMLAttributes = {
      ...(parsedAttrs || {}),
      ...(isRecord(ruleAttrs) ? ruleAttrs : {}),
    };

    return Object.keys(mergedAttrs).length > 0 ? mergedAttrs : null;
  };

  return nextRule;
};

export const injectExtensionAttributesToParseRules = <Rule extends ParseRule>(
  rules: readonly Rule[],
  attributeConfigs: AttributeConfigs | null
): Rule[] | null => {
  if (!Array.isArray(rules) || rules.length === 0) {
    return null;
  }

  return rules.map((rule) => injectExtensionAttributesToParseRule(rule, attributeConfigs));
};
