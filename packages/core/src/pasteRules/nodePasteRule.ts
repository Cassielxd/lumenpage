import type { NodeType } from "lumenpage-model";

import { PasteRule, type ExtendedRegExpMatchArray, type PasteRuleFinder } from "../PasteRule";

type JSONContent = Record<string, any>;

const callOrReturn = <Value>(
  value:
    | Value
    | ((matchOrAttrs: ExtendedRegExpMatchArray | Record<string, any>, event?: ClipboardEvent | null) => Value),
  matchOrAttrs: ExtendedRegExpMatchArray | Record<string, any>,
  event?: ClipboardEvent | null
) => {
  if (typeof value === "function") {
    return (
      value as (matchOrAttrs: ExtendedRegExpMatchArray | Record<string, any>, event?: ClipboardEvent | null) => Value
    )(matchOrAttrs, event);
  }
  return value;
};

export const nodePasteRule = (config: {
  find: PasteRuleFinder;
  type: NodeType;
  getAttributes?:
    | Record<string, any>
    | ((match: ExtendedRegExpMatchArray, event: ClipboardEvent | null) => Record<string, any>)
    | false
    | null;
  getContent?:
    | JSONContent[]
    | ((attrs: Record<string, any>) => JSONContent[])
    | false
    | null;
}) =>
  new PasteRule({
    find: config.find,
    handler: ({ state, range, match, pasteEvent }) => {
      const attributes = config.getAttributes
        ? callOrReturn(config.getAttributes, match, pasteEvent)
        : undefined;
      const content =
        attributes && config.getContent ? callOrReturn(config.getContent, attributes) : config.getContent;

      if (attributes === false || attributes === null) {
        return null;
      }

      if (!match.input) {
        return null;
      }

      const node = state.schema.nodeFromJSON({
        type: config.type.name,
        attrs: attributes || undefined,
        content: content || undefined,
      });

      state.tr.replaceRangeWith(range.from, range.to, node);
    },
  });
