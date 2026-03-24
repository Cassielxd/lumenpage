import type { MarkType } from "lumenpage-model";

import { PasteRule, type ExtendedRegExpMatchArray, type PasteRuleFinder } from "../PasteRule";

const callOrReturn = <Value>(
  value: Value | ((match: ExtendedRegExpMatchArray, event: ClipboardEvent | null) => Value),
  match: ExtendedRegExpMatchArray,
  event: ClipboardEvent | null
) => {
  if (typeof value === "function") {
    return (value as (match: ExtendedRegExpMatchArray, event: ClipboardEvent | null) => Value)(
      match,
      event
    );
  }
  return value;
};

const getMarksBetween = (from: number, to: number, doc: any) => {
  const marks: Array<{ mark: any; from: number; to: number }> = [];

  doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (!node?.isText || !Array.isArray(node.marks) || node.marks.length === 0) {
      return;
    }

    const start = Math.max(from, pos);
    const end = Math.min(to, pos + (node.nodeSize ?? 0));
    for (const mark of node.marks) {
      marks.push({ mark, from: start, to: end });
    }
  });

  return marks;
};

export const markPasteRule = (config: {
  find: PasteRuleFinder;
  type: MarkType;
  getAttributes?:
    | Record<string, any>
    | ((match: ExtendedRegExpMatchArray, event: ClipboardEvent | null) => Record<string, any>)
    | false
    | null;
}) =>
  new PasteRule({
    find: config.find,
    handler: ({ state, range, match, pasteEvent }) => {
      const attributes =
        config.getAttributes == null
          ? undefined
          : config.getAttributes === false
            ? false
            : callOrReturn(config.getAttributes, match, pasteEvent);

      if (attributes === false || attributes === null) {
        return null;
      }

      const { tr } = state;
      const captureGroup = match[match.length - 1];
      const fullMatch = match[0];
      let markEnd = range.to;

      if (captureGroup) {
        const startSpaces = fullMatch.search(/\S/);
        const textStart = range.from + fullMatch.indexOf(captureGroup);
        const textEnd = textStart + captureGroup.length;

        const excludedMarks = getMarksBetween(range.from, range.to, state.doc)
          .filter((item) => Array.isArray(item.mark?.type?.excluded))
          .filter((item) => item.mark.type.excluded.some((type: MarkType) => type === config.type))
          .filter((item) => item.mark.type !== config.type)
          .filter((item) => item.to > textStart);

        if (excludedMarks.length) {
          return null;
        }

        if (textEnd < range.to) {
          tr.delete(textEnd, range.to);
        }

        if (textStart > range.from) {
          tr.delete(range.from + startSpaces, textStart);
        }

        markEnd = range.from + startSpaces + captureGroup.length;
        tr.addMark(range.from + startSpaces, markEnd, config.type.create(attributes || {}));
        tr.removeStoredMark(config.type);
        return;
      }

      tr.addMark(range.from, markEnd, config.type.create(attributes || {}));
      tr.removeStoredMark(config.type);
    },
  });
