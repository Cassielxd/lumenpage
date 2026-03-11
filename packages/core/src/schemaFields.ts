import { getExtensionField, mergeDeep } from "./Extendable";
import type {
  AttributeConfigs,
  ExtensionContext,
  ExtensionInstance,
  GlobalAttributes,
  ResolvedStructure,
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

const buildAttrsSpec = (attributeConfigs: AttributeConfigs | null) => {
  if (!attributeConfigs || Object.keys(attributeConfigs).length === 0) {
    return null;
  }
  const attrs: Record<string, any> = {};
  for (const [name, config] of Object.entries(attributeConfigs)) {
    attrs[name] =
      config && Object.prototype.hasOwnProperty.call(config, "default")
        ? { default: config.default }
        : {};
  }
  return attrs;
};

const collectParsedAttributes = (attributeConfigs: AttributeConfigs | null, source: any) => {
  if (!attributeConfigs) {
    return null;
  }
  const attrs: Record<string, any> = {};
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

const buildParseDOM = (rules: any[], attributeConfigs: AttributeConfigs | null) => {
  if (!Array.isArray(rules) || rules.length === 0) {
    return null;
  }
  return rules.map((rule) => {
    if (!rule || typeof rule !== "object") {
      return rule;
    }
    const staticAttrs = rule.attrs && typeof rule.attrs === "object" ? rule.attrs : null;
    const originalGetAttrs = typeof rule.getAttrs === "function" ? rule.getAttrs : null;
    if (!originalGetAttrs && !staticAttrs && !attributeConfigs) {
      return rule;
    }
    const nextRule = { ...rule };
    delete nextRule.attrs;
    nextRule.getAttrs = (value: any) => {
      const parsedAttrs = collectParsedAttributes(attributeConfigs, value);
      const ruleAttrs = originalGetAttrs ? originalGetAttrs(value) : staticAttrs;
      if (ruleAttrs === false) {
        return false;
      }
      return {
        ...(parsedAttrs || {}),
        ...((ruleAttrs && typeof ruleAttrs === "object") ? ruleAttrs : {}),
      };
    };
    return nextRule;
  });
};

const buildHTMLAttributes = (attributeConfigs: AttributeConfigs | null, attrs: Record<string, any>) => {
  const htmlAttributes: Record<string, any> = {};
  if (!attributeConfigs) {
    return htmlAttributes;
  }
  for (const [name, config] of Object.entries(attributeConfigs)) {
    if (typeof config?.renderHTML === "function") {
      const rendered = config.renderHTML(attrs || {});
      if (rendered && typeof rendered === "object") {
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
  baseAttributes: Record<string, any> | null | undefined,
  nextAttributes: Record<string, any> | null | undefined
) => {
  const merged = {
    ...(baseAttributes || {}),
    ...(nextAttributes || {}),
  };

  if (baseAttributes?.style && nextAttributes?.style) {
    merged.style = `${String(baseAttributes.style)};${String(nextAttributes.style)}`;
  }

  return merged;
};

const isPlainAttributesObject = (value: any) =>
  !!value && typeof value === "object" && !Array.isArray(value) && typeof value.nodeType !== "number";

const injectHTMLAttributesIntoDOMOutput = (output: any, htmlAttributes: Record<string, any>) => {
  if (!Array.isArray(output) || Object.keys(htmlAttributes).length === 0) {
    return output;
  }

  const [tag, maybeAttrs, ...rest] = output;

  if (isPlainAttributesObject(maybeAttrs)) {
    return [tag, mergeHTMLAttributes(maybeAttrs, htmlAttributes), ...rest];
  }

  const nextOutput = [tag, htmlAttributes];
  if (maybeAttrs !== undefined) {
    nextOutput.push(maybeAttrs);
  }
  nextOutput.push(...rest);
  return nextOutput;
};

const mergeSchemaSpec = (generated: Record<string, any> | null, explicit: Record<string, any> | null) => {
  if (generated && explicit) {
    return mergeDeep(generated, explicit);
  }
  return generated || explicit || null;
};

const buildNodeSchema = (instance: ExtensionInstance, ctx: ExtensionContext) => {
  const attributeConfigs = resolveConfigField<AttributeConfigs | null>(instance, ctx, "addAttributes", null);
  const parseHTML = resolveConfigField<any[]>(instance, ctx, "parseHTML", []);
  const renderHTML = getExtensionField<any>(instance.extension, "renderHTML", ctx);
  const spec: Record<string, any> = {};

  for (const field of [
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
  ]) {
    const value = resolveConfigField<any>(instance, ctx, field, undefined);
    if (value !== undefined && value !== null) {
      spec[field] = value;
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
    spec.toDOM = (node: any) =>
      renderHTML({
        node,
        HTMLAttributes: buildHTMLAttributes(attributeConfigs, node?.attrs || {}),
      });
  }

  return Object.keys(spec).length > 0 ? spec : null;
};

const buildMarkSchema = (instance: ExtensionInstance, ctx: ExtensionContext) => {
  const attributeConfigs = resolveConfigField<AttributeConfigs | null>(instance, ctx, "addAttributes", null);
  const parseHTML = resolveConfigField<any[]>(instance, ctx, "parseHTML", []);
  const renderHTML = getExtensionField<any>(instance.extension, "renderHTML", ctx);
  const spec: Record<string, any> = {};

  for (const field of ["inclusive", "excludes", "spanning", "code"]) {
    const value = resolveConfigField<any>(instance, ctx, field, undefined);
    if (value !== undefined && value !== null) {
      spec[field] = value;
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
    spec.toDOM = (mark: any) =>
      renderHTML({
        mark,
        HTMLAttributes: buildHTMLAttributes(attributeConfigs, mark?.attrs || {}),
      });
  }

  return Object.keys(spec).length > 0 ? spec : null;
};

export const resolveExtensionSchema = (instance: ExtensionInstance, ctx: ExtensionContext) => {
  if (instance.type !== "node" && instance.type !== "mark") {
    return null;
  }
  const generated =
    instance.type === "node" ? buildNodeSchema(instance, ctx) : buildMarkSchema(instance, ctx);
  const explicit = resolveConfigField<Record<string, any> | null>(instance, ctx, "schema", null);
  return mergeSchemaSpec(generated, explicit);
};

const applyAttributeConfigsToSpec = (spec: Record<string, any>, attributeConfigs: AttributeConfigs) => {
  const nextSpec = { ...spec };
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
    nextSpec.toDOM = (nodeOrMark: any) =>
      injectHTMLAttributesIntoDOMOutput(
        originalToDOM(nodeOrMark),
        buildHTMLAttributes(attributeConfigs, nodeOrMark?.attrs || {})
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
        schema.nodes[typeName] = applyAttributeConfigsToSpec(schema.nodes[typeName], entry.attributes);
        continue;
      }
      if (typeName in schema.marks) {
        schema.marks[typeName] = applyAttributeConfigsToSpec(schema.marks[typeName], entry.attributes);
      }
    }
  }
};
