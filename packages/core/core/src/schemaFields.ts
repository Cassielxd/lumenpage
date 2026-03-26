import type {
  AttributeSpec,
  DOMOutputSpec,
  Mark as PMMark,
  MarkSpec,
  Node as PMNode,
  NodeSpec,
  ParseRule,
  TagParseRule,
} from "lumenpage-model";

import { getExtensionField, mergeDeep } from "./Extendable";
import type {
  AttributeConfigs,
  ExtensionContext,
  ExtensionInstance,
  GlobalAttributes,
  HTMLAttributes,
  ParseHTMLSource,
  ResolvedStructure,
  UnknownRecord,
} from "./types";

const callConfigValue = <Value>(value: Value | (() => Value) | undefined, fallback: Value) => {
  if (typeof value === "function") {
    return (value as () => Value)();
  }
  return value ?? fallback;
};

const resolveConfigField = <Value>(
  instance: ExtensionInstance,
  ctx: ExtensionContext,
  field: string,
  fallback: Value
) => callConfigValue(getExtensionField<Value | (() => Value)>(instance.extension, field, ctx), fallback);

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isStyleRule = (rule: ParseRule): rule is Extract<ParseRule, { style: string }> =>
  typeof (rule as { style?: unknown }).style === "string";

type AttributeSpecMap = Record<string, AttributeSpec>;
type GeneratedNodeSpec = NodeSpec & { topNode?: boolean };

const buildAttrsSpec = (attributeConfigs: AttributeConfigs | null): AttributeSpecMap | null => {
  if (!attributeConfigs || Object.keys(attributeConfigs).length === 0) {
    return null;
  }

  const attrs: AttributeSpecMap = {};
  for (const [name, config] of Object.entries(attributeConfigs)) {
    attrs[name] =
      config && Object.prototype.hasOwnProperty.call(config, "default")
        ? { default: config.default }
        : {};
  }

  return attrs;
};

const collectParsedAttributes = (
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

const buildParseDOM = <Rule extends ParseRule>(
  rules: readonly Rule[],
  attributeConfigs: AttributeConfigs | null
): Rule[] | null => {
  if (!Array.isArray(rules) || rules.length === 0) {
    return null;
  }

  return rules.map((rule) => {
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
        : collectParsedAttributes(attributeConfigs, rawValue as ParseHTMLSource);
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
  });
};

const buildHTMLAttributes = (
  attributeConfigs: AttributeConfigs | null,
  attrs: HTMLAttributes | null | undefined
): HTMLAttributes => {
  const htmlAttributes: HTMLAttributes = {};

  if (!attributeConfigs) {
    return htmlAttributes;
  }

  for (const [name, config] of Object.entries(attributeConfigs)) {
    if (typeof config?.renderHTML === "function") {
      const rendered = config.renderHTML(attrs || {});
      if (isRecord(rendered)) {
        for (const [key, value] of Object.entries(rendered)) {
          if (key === "style" && htmlAttributes.style && value) {
            htmlAttributes.style = `${String(htmlAttributes.style)};${String(value)}`;
            continue;
          }
          htmlAttributes[key] = value;
        }
      }
      continue;
    }

    const value = attrs?.[name];
    if (value !== null && value !== undefined) {
      htmlAttributes[name] = value;
    }
  }

  return htmlAttributes;
};

const mergeHTMLAttributes = (
  baseAttributes: HTMLAttributes | null | undefined,
  nextAttributes: HTMLAttributes | null | undefined
): HTMLAttributes => {
  const merged: HTMLAttributes = {
    ...(baseAttributes || {}),
    ...(nextAttributes || {}),
  };

  if (baseAttributes?.style && nextAttributes?.style) {
    merged.style = `${String(baseAttributes.style)};${String(nextAttributes.style)}`;
  }

  return merged;
};

const isPlainAttributesObject = (value: unknown): value is UnknownRecord =>
  isRecord(value) && typeof value.nodeType !== "number";

const injectHTMLAttributesIntoDOMOutput = (
  output: DOMOutputSpec,
  htmlAttributes: HTMLAttributes
): DOMOutputSpec => {
  if (!Array.isArray(output) || Object.keys(htmlAttributes).length === 0) {
    return output;
  }

  const [tag, maybeAttrs, ...rest] = output;

  if (isPlainAttributesObject(maybeAttrs)) {
    return [tag, mergeHTMLAttributes(maybeAttrs, htmlAttributes), ...rest];
  }

  const nextOutput: [string, ...unknown[]] = [tag, htmlAttributes];
  if (maybeAttrs !== undefined) {
    nextOutput.push(maybeAttrs);
  }
  nextOutput.push(...rest);
  return nextOutput;
};

const mergeSchemaSpec = <T extends NodeSpec | MarkSpec>(generated: T | null, explicit: T | null): T | null => {
  if (generated && explicit) {
    return mergeDeep(generated, explicit);
  }
  return generated || explicit || null;
};

const NODE_SCHEMA_FIELDS = [
  "topNode",
  "content",
  "marks",
  "group",
  "inline",
  "atom",
  "selectable",
  "draggable",
  "code",
  "whitespace",
  "isolating",
  "defining",
  "linebreakReplacement",
] as const;

const MARK_SCHEMA_FIELDS = ["inclusive", "excludes", "group", "spanning", "code"] as const;

const buildNodeSchema = (instance: ExtensionInstance, ctx: ExtensionContext): GeneratedNodeSpec | null => {
  const attributeConfigs = resolveConfigField<AttributeConfigs | null>(instance, ctx, "addAttributes", null);
  const parseHTML = resolveConfigField<readonly TagParseRule[]>(instance, ctx, "parseHTML", []);
  const renderHTML = getExtensionField<
    ((props: { node: PMNode; HTMLAttributes: HTMLAttributes }) => DOMOutputSpec) | undefined
  >(instance.extension, "renderHTML", ctx);
  const spec: GeneratedNodeSpec = {};

  for (const field of NODE_SCHEMA_FIELDS) {
    const value = resolveConfigField<unknown>(instance, ctx, field, undefined);
    if (value !== undefined && value !== null) {
      (spec as Record<string, unknown>)[field] = value;
    }
  }

  const attrs = buildAttrsSpec(attributeConfigs);
  if (attrs) {
    spec.attrs = attrs;
  }

  const parseDOM = buildParseDOM(parseHTML, attributeConfigs);
  if (parseDOM) {
    spec.parseDOM = parseDOM;
  }

  if (typeof renderHTML === "function") {
    spec.toDOM = (node: PMNode) =>
      renderHTML({
        node,
        HTMLAttributes: buildHTMLAttributes(attributeConfigs, node.attrs as HTMLAttributes | undefined),
      });
  }

  return Object.keys(spec).length > 0 ? spec : null;
};

const buildMarkSchema = (instance: ExtensionInstance, ctx: ExtensionContext): MarkSpec | null => {
  const attributeConfigs = resolveConfigField<AttributeConfigs | null>(instance, ctx, "addAttributes", null);
  const parseHTML = resolveConfigField<readonly ParseRule[]>(instance, ctx, "parseHTML", []);
  const renderHTML = getExtensionField<
    ((props: { mark: PMMark; HTMLAttributes: HTMLAttributes }) => DOMOutputSpec) | undefined
  >(instance.extension, "renderHTML", ctx);
  const spec: MarkSpec = {};

  for (const field of MARK_SCHEMA_FIELDS) {
    const value = resolveConfigField<unknown>(instance, ctx, field, undefined);
    if (value !== undefined && value !== null) {
      (spec as Record<string, unknown>)[field] = value;
    }
  }

  const attrs = buildAttrsSpec(attributeConfigs);
  if (attrs) {
    spec.attrs = attrs;
  }

  const parseDOM = buildParseDOM(parseHTML, attributeConfigs);
  if (parseDOM) {
    spec.parseDOM = parseDOM;
  }

  if (typeof renderHTML === "function") {
    spec.toDOM = (mark: PMMark, inline: boolean) =>
      renderHTML({
        mark,
        HTMLAttributes: buildHTMLAttributes(attributeConfigs, mark.attrs as HTMLAttributes | undefined),
      });
  }

  return Object.keys(spec).length > 0 ? spec : null;
};

export const resolveExtensionSchema = (instance: ExtensionInstance, ctx: ExtensionContext) => {
  if (instance.type === "node") {
    const generated = buildNodeSchema(instance, ctx);
    const explicit = resolveConfigField<NodeSpec | null>(instance, ctx, "schema", null);
    return mergeSchemaSpec(generated, explicit);
  }

  if (instance.type === "mark") {
    const generated = buildMarkSchema(instance, ctx);
    const explicit = resolveConfigField<MarkSpec | null>(instance, ctx, "schema", null);
    return mergeSchemaSpec(generated, explicit);
  }

  return null;
};

const applyAttributeConfigsToNodeSpec = (
  spec: NodeSpec,
  attributeConfigs: AttributeConfigs
): NodeSpec => {
  const nextSpec: NodeSpec = { ...spec };
  const attrs = buildAttrsSpec(attributeConfigs);
  if (attrs) {
    nextSpec.attrs = mergeDeep(attrs, nextSpec.attrs || {});
  }

  const parseDOM = buildParseDOM(nextSpec.parseDOM || [], attributeConfigs);
  if (parseDOM) {
    nextSpec.parseDOM = parseDOM;
  }

  if (typeof nextSpec.toDOM === "function") {
    const originalToDOM = nextSpec.toDOM;
    nextSpec.toDOM = (node: PMNode) =>
      injectHTMLAttributesIntoDOMOutput(
        originalToDOM(node),
        buildHTMLAttributes(attributeConfigs, node.attrs as HTMLAttributes | undefined)
      );
  }

  return nextSpec;
};

const applyAttributeConfigsToMarkSpec = (
  spec: MarkSpec,
  attributeConfigs: AttributeConfigs
): MarkSpec => {
  const nextSpec: MarkSpec = { ...spec };
  const attrs = buildAttrsSpec(attributeConfigs);
  if (attrs) {
    nextSpec.attrs = mergeDeep(attrs, nextSpec.attrs || {});
  }

  const parseDOM = buildParseDOM(nextSpec.parseDOM || [], attributeConfigs);
  if (parseDOM) {
    nextSpec.parseDOM = parseDOM;
  }

  if (typeof nextSpec.toDOM === "function") {
    const originalToDOM = nextSpec.toDOM;
    nextSpec.toDOM = (mark: PMMark, inline: boolean) =>
      injectHTMLAttributesIntoDOMOutput(
        originalToDOM(mark, inline),
        buildHTMLAttributes(attributeConfigs, mark.attrs as HTMLAttributes | undefined)
      );
  }

  return nextSpec;
};

export const applyGlobalAttributesToSchema = (
  schema: ResolvedStructure["schema"],
  globalAttributes: GlobalAttributes
) => {
  for (const entry of globalAttributes) {
    if (!entry || !Array.isArray(entry.types) || !entry.attributes) {
      continue;
    }

    for (const typeName of entry.types) {
      if (typeName in schema.nodes) {
        schema.nodes[typeName] = applyAttributeConfigsToNodeSpec(schema.nodes[typeName], entry.attributes);
        continue;
      }
      if (typeName in schema.marks) {
        schema.marks[typeName] = applyAttributeConfigsToMarkSpec(schema.marks[typeName], entry.attributes);
      }
    }
  }
};
