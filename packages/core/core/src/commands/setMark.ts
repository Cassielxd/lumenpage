import type { MarkType } from "lumenpage-model";
import type { EditorState, Transaction } from "lumenpage-state";

import { getMarkType } from "../helpers/getMarkType.js";
import type { RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    setMark: {
      setMark: (
        typeOrName: string | MarkType,
        attributes?: Record<string, unknown>
      ) => ReturnType;
    };
  }
}

const canSetMark = (state: EditorState, tr: Transaction, type: MarkType) => {
  const selection = tr.selection as Transaction["selection"] & {
    $from?: {
      parent?: { type: { allowsMarkType: (markType: MarkType) => boolean } };
    };
  };

  if (selection.empty) {
    return selection.$from?.parent?.type?.allowsMarkType?.(type) ?? true;
  }

  let allowed = false;

  state.doc.nodesBetween(selection.from, selection.to, (node, _pos, parent) => {
    if (allowed || !node.isInline) {
      return !allowed;
    }

    const parentAllows = !parent || parent.type.allowsMarkType(type);
    const markAllowed =
      !!type.isInSet(node.marks) || !node.marks.some((mark) => mark.type.excludes(type));

    if (parentAllows && markAllowed) {
      allowed = true;
      return false;
    }

    return undefined;
  });

  return allowed;
};

export const setMark: RawCommands["setMark"] = (typeOrName, attributes = {}) => ({
  tr,
  state,
  dispatch,
}) => {
  const type = getMarkType(typeOrName, state.schema);
  const selection = tr.selection as Transaction["selection"] & {
    ranges: Array<{ $from: { pos: number }; $to: { pos: number } }>;
    $from?: {
      marks?: () => Array<{ type: MarkType; attrs?: Record<string, unknown> }>;
    };
  };

  if (dispatch) {
    if (selection.empty) {
      const storedMark = (state.storedMarks || selection.$from?.marks?.() || []).find(
        (mark) => mark.type === type
      );

      tr.addStoredMark(
        type.create({
          ...(storedMark?.attrs || {}),
          ...attributes,
        })
      );
    } else {
      selection.ranges.forEach((range) => {
        const from = range.$from.pos;
        const to = range.$to.pos;

        state.doc.nodesBetween(from, to, (node, pos) => {
          const trimmedFrom = Math.max(pos, from);
          const trimmedTo = Math.min(pos + node.nodeSize, to);
          const current = node.marks.find((mark) => mark.type === type);

          if (trimmedFrom >= trimmedTo) {
            return;
          }

          if (current) {
            tr.addMark(
              trimmedFrom,
              trimmedTo,
              type.create({
                ...(current.attrs || {}),
                ...attributes,
              })
            );
            return;
          }

          tr.addMark(trimmedFrom, trimmedTo, type.create(attributes));
        });
      });
    }
  }

  return canSetMark(state, tr, type);
};
