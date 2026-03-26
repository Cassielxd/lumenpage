import type { MarkType } from "lumenpage-model";
import type { EditorState } from "lumenpage-state";

import { matchAttributes } from "./matchAttributes";

export const isMarkActive = (
  state: EditorState,
  type: MarkType,
  attributes: Record<string, unknown> = {}
) => {
  const selection = state.selection as EditorState["selection"] & {
    $from?: {
      marks?: () => Array<{ type: MarkType; attrs?: Record<string, unknown> }>;
    };
  };

  if (selection.empty) {
    const marks = state.storedMarks || selection.$from?.marks?.() || [];

    return marks.some((mark) => mark.type === type && matchAttributes(mark.attrs, attributes));
  }

  let hasMarkedContent = false;
  let allMarked = true;

  state.doc.nodesBetween(selection.from, selection.to, (node, pos, parent) => {
    if (!node.isInline) {
      return;
    }

    const from = Math.max(pos, selection.from);
    const to = Math.min(pos + node.nodeSize, selection.to);

    if (from >= to) {
      return;
    }

    if (parent && !parent.type.allowsMarkType(type)) {
      return;
    }

    hasMarkedContent = true;

    const mark = node.marks.find(
      (item) => item.type === type && matchAttributes(item.attrs as Record<string, unknown>, attributes)
    );

    if (!mark) {
      allMarked = false;
      return false;
    }

    return undefined;
  });

  return hasMarkedContent && allMarked;
};
