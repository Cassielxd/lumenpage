import type { Mark as PMMark, MarkSpec, Node as PMNode, NodeSpec } from "lumenpage-model";

import { getAttributeSpecs } from "./getAttributeSpecs.js";
import { getRenderedAttributes } from "./getRenderedAttributes.js";
import { injectExtensionAttributesToParseRules } from "./injectExtensionAttributesToParseRule.js";
import { injectRenderedAttributesToDOMOutput } from "./injectRenderedAttributesToDOMOutput.js";
import { mergeDeep } from "../utilities/mergeDeep.js";
import type {
  AttributeConfigs,
  GlobalAttributes,
  HTMLAttributes,
  ResolvedStructure,
} from "../types.js";

const applyAttributeConfigsToNodeSpec = (
  spec: NodeSpec,
  attributeConfigs: AttributeConfigs
): NodeSpec => {
  const nextSpec: NodeSpec = { ...spec };
  const attrs = getAttributeSpecs(attributeConfigs);

  if (attrs) {
    nextSpec.attrs = mergeDeep(attrs, nextSpec.attrs || {});
  }

  const parseDOM = injectExtensionAttributesToParseRules(nextSpec.parseDOM || [], attributeConfigs);

  if (parseDOM) {
    nextSpec.parseDOM = parseDOM;
  }

  if (typeof nextSpec.toDOM === "function") {
    const originalToDOM = nextSpec.toDOM;
    nextSpec.toDOM = (node: PMNode) =>
      injectRenderedAttributesToDOMOutput(
        originalToDOM(node),
        getRenderedAttributes(attributeConfigs, node.attrs as HTMLAttributes | undefined)
      );
  }

  return nextSpec;
};

const applyAttributeConfigsToMarkSpec = (
  spec: MarkSpec,
  attributeConfigs: AttributeConfigs
): MarkSpec => {
  const nextSpec: MarkSpec = { ...spec };
  const attrs = getAttributeSpecs(attributeConfigs);

  if (attrs) {
    nextSpec.attrs = mergeDeep(attrs, nextSpec.attrs || {});
  }

  const parseDOM = injectExtensionAttributesToParseRules(nextSpec.parseDOM || [], attributeConfigs);

  if (parseDOM) {
    nextSpec.parseDOM = parseDOM;
  }

  if (typeof nextSpec.toDOM === "function") {
    const originalToDOM = nextSpec.toDOM;
    nextSpec.toDOM = (mark: PMMark, inline: boolean) =>
      injectRenderedAttributesToDOMOutput(
        originalToDOM(mark, inline),
        getRenderedAttributes(attributeConfigs, mark.attrs as HTMLAttributes | undefined)
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
