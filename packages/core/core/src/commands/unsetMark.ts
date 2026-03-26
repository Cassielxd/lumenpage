import type { MarkType } from "lumenpage-model";

import { getMarkType } from "../helpers/getMarkType";
import type { RawCommands } from "../types";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    unsetMark: {
      unsetMark: (
        typeOrName: string | MarkType,
        options?: {
          extendEmptyMarkRange?: boolean;
        }
      ) => ReturnType;
    };
  }
}

export const unsetMark: RawCommands["unsetMark"] = (_typeOrName, _options = {}) => ({
  tr,
  state,
  dispatch,
}) => {
  const type = getMarkType(_typeOrName, state.schema);
  const selection = tr.selection as typeof tr.selection & {
    ranges: Array<{ $from: { pos: number }; $to: { pos: number } }>;
  };

  if (!dispatch) {
    return true;
  }

  if (selection.empty) {
    const cursor = selection.$from;
    const marks = state.storedMarks || cursor.marks();
    const mark = marks.find((item) => item.type === type);

    if (mark) {
      let from = cursor.pos;
      let to = cursor.pos;

      while (from > 0 && type.isInSet(tr.doc.resolve(from).marks())) {
        from -= 1;
      }

      while (to < tr.doc.content.size && type.isInSet(tr.doc.resolve(to).marks())) {
        to += 1;
      }

      if (from < to) {
        tr.removeMark(from, to, type);
      }
    }
  } else {
    selection.ranges.forEach((range) => {
      tr.removeMark(range.$from.pos, range.$to.pos, type);
    });
  }

  tr.removeStoredMark(type);

  return true;
};
