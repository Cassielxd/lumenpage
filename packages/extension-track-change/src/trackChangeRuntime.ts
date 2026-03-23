import { ChangeSet, simplifyChanges } from "lumenpage-extension-changeset";
import { Extension } from "lumenpage-core";
import { Selection, TextSelection } from "lumenpage-state";

import { findTrackChangeRanges, rangeHasTrackChangeMark } from "./trackChangeMark";
import { createTrackChangePlugin, getTrackChangePluginState } from "./trackChangePlugin";
import { rewriteTransactionAsTrackChanges } from "./rewriteTransaction";
import {
  TRACK_CHANGE_META,
  createDefaultTrackChangesOptions,
  markTrackChangeTransaction,
  normalizeTrackChangeId,
  type TrackChangesOptions,
} from "./types";

const getTrackChangeMarkType = (state: any) => state?.schema?.marks?.trackChange || null;

const getSkippedTrackChangeBoundary = (state: any, direction: "backward" | "forward") => {
  const selection = state?.selection;
  const anchor = Number(selection?.from);
  if (!selection?.empty || !Number.isFinite(anchor)) {
    return null;
  }

  const ranges = findTrackChangeRanges(state);
  if (ranges.length === 0) {
    return null;
  }

  let nextPos = anchor;
  let moved = false;
  while (true) {
    const matched =
      direction === "backward"
        ? [...ranges].reverse().find((range) => range.to === nextPos) || null
        : ranges.find((range) => range.from === nextPos) || null;
    if (!matched) {
      break;
    }
    nextPos = direction === "backward" ? matched.from : matched.to;
    moved = true;
  }

  return moved ? nextPos : null;
};

const createProtectedTrackChangeDeleteCommand =
  (direction: "backward" | "forward") =>
  (state: any, dispatch?: (tr: any) => void) => {
    if (getTrackChangePluginState(state).enabled !== true) {
      return false;
    }

    const selection = state?.selection;
    const from = Number(selection?.from);
    const to = Number(selection?.to);
    if (!selection || !Number.isFinite(from) || !Number.isFinite(to)) {
      return false;
    }

    if (!selection.empty) {
      if (!rangeHasTrackChangeMark(state, Math.min(from, to), Math.max(from, to))) {
        return false;
      }
      if (!dispatch || !state?.tr) {
        return true;
      }
      dispatch(
        markTrackChangeTransaction(state.tr.setMeta("addToHistory", false), {
          refresh: true,
        })
      );
      return true;
    }

    const skippedPos = getSkippedTrackChangeBoundary(state, direction);
    if (!Number.isFinite(skippedPos)) {
      return false;
    }
    if (!dispatch || !state?.tr || !state?.doc) {
      return true;
    }

    try {
      const tr = state.tr
        .setSelection(Selection.near(state.doc.resolve(skippedPos), direction === "backward" ? -1 : 1))
        .setMeta("addToHistory", false);
      dispatch(
        markTrackChangeTransaction(tr, {
          refresh: true,
        })
      );
      return true;
    } catch (_error) {
      return false;
    }
  };

const transactionTouchesTrackChange = (state: any, transaction: any) => {
  const oldDoc = state?.doc;
  const newDoc = transaction?.doc;
  if (!oldDoc || !newDoc || !transaction?.mapping?.maps) {
    return false;
  }

  const changeSet = ChangeSet.create(oldDoc).addSteps(newDoc, transaction.mapping.maps, 0);
  const changes = simplifyChanges(changeSet.changes, newDoc).filter((change) => {
    return change.toA > change.fromA || change.toB > change.fromB;
  });

  return changes.some((change) => {
    return (
      rangeHasTrackChangeMark({ doc: oldDoc, schema: oldDoc.type.schema }, change.fromA, change.toA) ||
      rangeHasTrackChangeMark({ doc: newDoc, schema: newDoc.type.schema }, change.fromB, change.toB)
    );
  });
};

const createSetTrackChangesCommand =
  (enabled: boolean) =>
  (state: any, dispatch?: (tr: any) => void) => {
    if (!state?.tr) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    const tr = state.tr.setMeta(TRACK_CHANGE_META, { enabled }).setMeta("addToHistory", false);
    dispatch(tr);
    return true;
  };

const createToggleTrackChangesCommand =
  () =>
  (state: any, dispatch?: (tr: any) => void) => {
    const current = getTrackChangePluginState(state).enabled === true;
    return createSetTrackChangesCommand(!current)(state, dispatch);
  };

const createSetActiveTrackChangeCommand =
  (changeId: string | null) =>
  (state: any, dispatch?: (tr: any) => void) => {
    if (!state?.tr) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    const tr = state.tr
      .setMeta(TRACK_CHANGE_META, { activeChangeId: normalizeTrackChangeId(changeId) })
      .setMeta("addToHistory", false);
    dispatch(tr);
    return true;
  };

const applyTrackChangeMutation = (
  state: any,
  changeId: string,
  resolveAction: (kind: "insert" | "delete", tr: any, range: { from: number; to: number; attrs: any }) => any
) => {
  const type = getTrackChangeMarkType(state);
  const normalizedChangeId = normalizeTrackChangeId(changeId);
  if (!type || !normalizedChangeId) {
    return null;
  }

  const ranges = findTrackChangeRanges(state, normalizedChangeId);
  if (ranges.length === 0) {
    return null;
  }

  let tr = state.tr;
  for (const range of [...ranges].sort((left, right) => right.from - left.from)) {
    tr = resolveAction(range.kind, tr, {
      from: range.from,
      to: range.to,
      attrs: range,
    });
  }
  return markTrackChangeTransaction(tr, {
    activeChangeId: null,
  });
};

const createAcceptTrackChangeCommand =
  (changeId: string) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = getTrackChangeMarkType(state);
    if (!type) {
      return false;
    }
    const tr = applyTrackChangeMutation(state, changeId, (kind, currentTr, range) => {
      if (kind === "delete") {
        return currentTr.delete(range.from, range.to);
      }
      return currentTr.removeMark(range.from, range.to, type.create(range.attrs));
    });
    if (!tr) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    dispatch(tr.scrollIntoView());
    return true;
  };

const createRejectTrackChangeCommand =
  (changeId: string) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = getTrackChangeMarkType(state);
    if (!type) {
      return false;
    }
    const tr = applyTrackChangeMutation(state, changeId, (kind, currentTr, range) => {
      if (kind === "insert") {
        return currentTr.delete(range.from, range.to);
      }
      return currentTr.removeMark(range.from, range.to, type.create(range.attrs));
    });
    if (!tr) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    dispatch(tr.scrollIntoView());
    return true;
  };

const createApplyAllTrackChangesCommand =
  (mode: "accept" | "reject") =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = getTrackChangeMarkType(state);
    if (!type) {
      return false;
    }
    const ranges = findTrackChangeRanges(state);
    if (ranges.length === 0) {
      return false;
    }

    let tr = state.tr;
    for (const range of [...ranges].sort((left, right) => right.from - left.from)) {
      if (mode === "accept") {
        tr =
          range.kind === "delete"
            ? tr.delete(range.from, range.to)
            : tr.removeMark(range.from, range.to, type.create(range));
      } else {
        tr =
          range.kind === "insert"
            ? tr.delete(range.from, range.to)
            : tr.removeMark(range.from, range.to, type.create(range));
      }
    }

    if (!dispatch) {
      return true;
    }
    dispatch(
      markTrackChangeTransaction(tr, {
        activeChangeId: null,
      }).scrollIntoView()
    );
    return true;
  };

const createFocusTrackChangeCommand =
  (changeId: string) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const normalizedChangeId = normalizeTrackChangeId(changeId);
    if (!normalizedChangeId || !state?.doc || !state?.tr) {
      return false;
    }
    const ranges = findTrackChangeRanges(state, normalizedChangeId);
    if (ranges.length === 0) {
      return false;
    }
    const from = Math.min(...ranges.map((range) => range.from));
    const to = Math.max(...ranges.map((range) => range.to));
    if (!dispatch) {
      return true;
    }
    try {
      const selection =
        from === to
          ? Selection.near(state.doc.resolve(to), 1)
          : TextSelection.create(state.doc, from, to);
      const tr = state.tr
        .setSelection(selection)
        .setMeta(TRACK_CHANGE_META, { activeChangeId: normalizedChangeId })
        .setMeta("addToHistory", false)
        .scrollIntoView();
      dispatch(tr);
      return true;
    } catch (_error) {
      return false;
    }
  };

export const TrackChangeRuntime = Extension.create<TrackChangesOptions>({
  name: "trackChangesRuntime",
  priority: 170,
  addOptions() {
    return createDefaultTrackChangesOptions();
  },
  addCommands() {
    return {
      setTrackChanges: (enabled: boolean) => createSetTrackChangesCommand(enabled),
      toggleTrackChanges: () => createToggleTrackChangesCommand(),
      setActiveTrackChange: (changeId: string | null) => createSetActiveTrackChangeCommand(changeId),
      acceptTrackChange: (changeId: string) => createAcceptTrackChangeCommand(changeId),
      rejectTrackChange: (changeId: string) => createRejectTrackChangeCommand(changeId),
      acceptAllTrackChanges: () => createApplyAllTrackChangesCommand("accept"),
      rejectAllTrackChanges: () => createApplyAllTrackChangesCommand("reject"),
      focusTrackChange: (changeId: string) => createFocusTrackChangeCommand(changeId),
    };
  },
  addKeyboardShortcuts() {
    return {
      Backspace: createProtectedTrackChangeDeleteCommand("backward"),
      "Shift-Backspace": createProtectedTrackChangeDeleteCommand("backward"),
      "Mod-Backspace": createProtectedTrackChangeDeleteCommand("backward"),
      Delete: createProtectedTrackChangeDeleteCommand("forward"),
      "Mod-Delete": createProtectedTrackChangeDeleteCommand("forward"),
    };
  },
  addPlugins() {
    return [createTrackChangePlugin(this.options)];
  },
  dispatchTransaction({ transaction, next }) {
    const editorState = this.editor?.view?.state || this.editor?.state;
    if (!editorState || transaction?.docChanged !== true) {
      next(transaction);
      return;
    }

    const meta = transaction?.getMeta?.(TRACK_CHANGE_META) || null;
    if (meta?.skipTracking === true) {
      next(transaction);
      return;
    }

    if (getTrackChangePluginState(editorState).enabled !== true) {
      next(transaction);
      return;
    }

    const rewritten = rewriteTransactionAsTrackChanges({
      state: editorState,
      transaction,
      options: this.options,
    });
    if (rewritten) {
      next(rewritten);
      return;
    }

    if (transactionTouchesTrackChange(editorState, transaction)) {
      next(
        markTrackChangeTransaction(editorState.tr.setMeta("addToHistory", false), {
          refresh: true,
        })
      );
      return;
    }

    next(transaction);
  },
});

export default TrackChangeRuntime;
