import type {
  DOMOutputSpec,
  Mark as PMMark,
  MarkSpec,
  Node as PMNode,
  NodeSpec,
  ParseRule,
  TagParseRule,
} from "lumenpage-model";

import { getAttributeSpecs } from "./getAttributeSpecs.js";
import { getExtensionField } from "./getExtensionField.js";
import { getRenderedAttributes } from "./getRenderedAttributes.js";
import { injectExtensionAttributesToParseRules } from "./injectExtensionAttributesToParseRule.js";
import { resolveConfigField } from "./resolveConfigField.js";
import { mergeDeep } from "../utilities/mergeDeep.js";
import type {
  AttributeConfigs,
  ExtensionContext,
  ExtensionInstance,
  HTMLAttributes,
} from "../types.js";

type GeneratedNodeSpec = NodeSpec & { topNode?: boolean };

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

  const attrs = getAttributeSpecs(attributeConfigs);

  if (attrs) {
    spec.attrs = attrs;
  }

  const parseDOM = injectExtensionAttributesToParseRules(parseHTML, attributeConfigs);

  if (parseDOM) {
    spec.parseDOM = parseDOM;
  }

  if (typeof renderHTML === "function") {
    spec.toDOM = (node: PMNode) =>
      renderHTML({
        node,
        HTMLAttributes: getRenderedAttributes(attributeConfigs, node.attrs as HTMLAttributes | undefined),
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

  const attrs = getAttributeSpecs(attributeConfigs);

  if (attrs) {
    spec.attrs = attrs;
  }

  const parseDOM = injectExtensionAttributesToParseRules(parseHTML, attributeConfigs);

  if (parseDOM) {
    spec.parseDOM = parseDOM;
  }

  if (typeof renderHTML === "function") {
    spec.toDOM = (mark: PMMark, inline: boolean) =>
      renderHTML({
        mark,
        HTMLAttributes: getRenderedAttributes(attributeConfigs, mark.attrs as HTMLAttributes | undefined),
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
