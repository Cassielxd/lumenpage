import { AllSelection, Selection } from "lumenpage-state";

import type { FocusPosition, RawCommands } from "../types.js";

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    focus: {
      focus: (
        position?: FocusPosition,
        options?: {
          scrollIntoView?: boolean;
        }
      ) => ReturnType;
    };
  }
}

const clampPosition = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const resolveFocusSelection = (doc: Parameters<typeof Selection.atEnd>[0], position: FocusPosition) => {
  if (position == null || position === true) {
    return null;
  }

  if (position === "start") {
    return Selection.atStart(doc);
  }

  if (position === "end") {
    return Selection.atEnd(doc);
  }

  if (position === "all") {
    return new AllSelection(doc);
  }

  if (typeof position === "number" && Number.isFinite(position)) {
    const resolvedPosition = clampPosition(position, 0, doc.content.size);
    return Selection.near(doc.resolve(resolvedPosition), 1);
  }

  return null;
};

export const focus: RawCommands["focus"] =
  (position = null, options = {}) =>
  ({ view, tr, dispatch, state }) => {
    if (!view) {
      return false;
    }

    const resolvedOptions = {
      scrollIntoView: true,
      ...options,
    };

    try {
      if (position == null && view.hasFocus()) {
        return true;
      }
    } catch (_error) {
      return false;
    }

    const selection = resolveFocusSelection(tr.doc, position);

    if (dispatch && selection && !state.selection.eq(selection)) {
      tr.setSelection(selection);
    }

    if (dispatch && resolvedOptions.scrollIntoView !== false) {
      tr.scrollIntoView();
    }

    view.focus();

    return true;
  };
