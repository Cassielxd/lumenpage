import { ChangeSet, simplifyChanges, type Change } from "lumenpage-extension-changeset";
import { Fragment, Slice } from "lumenpage-model";
import { Selection, TextSelection } from "lumenpage-state";

import {
  fragmentHasTrackChangeMark,
  rangeHasTrackChangeMark,
} from "./trackChangeMark";
import {
  markTrackChangeTransaction,
  normalizeTrackChangeAttrs,
  type TrackChangeAttrs,
  type TrackChangesOptions,
} from "./types";

const createTrackChangeId = () => {
  const randomUuid =
    typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : null;
  if (randomUuid) {
    return `change-${randomUuid}`;
  }
  return `change-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const isInlineFragment = (fragment: Fragment | null | undefined) => {
  if (!fragment) {
    return true;
  }
  let valid = true;
  fragment.descendants((node: any) => {
    if (!node?.isInline) {
      valid = false;
      return false;
    }
    return undefined;
  });
  return valid;
};

const isInlineRange = (doc: any, from: number, to: number) => {
  try {
    const $from = doc.resolve(from);
    const $to = doc.resolve(to);
    return $from.sameParent($to) && $from.parent.inlineContent === true;
  } catch (_error) {
    return false;
  }
};

const isInlinePosition = (doc: any, pos: number) => {
  try {
    return doc.resolve(pos).parent.inlineContent === true;
  } catch (_error) {
    return false;
  }
};

const getTrackChangeAttrsFromMarks = (
  marks: readonly any[] | null | undefined,
  markType: any,
  kind?: TrackChangeAttrs["kind"]
): TrackChangeAttrs | null => {
  if (!Array.isArray(marks) || marks.length === 0) {
    return null;
  }
  for (const mark of marks) {
    if (mark?.type !== markType) {
      continue;
    }
    const attrs = normalizeTrackChangeAttrs(mark?.attrs);
    if (!attrs) {
      continue;
    }
    if (kind && attrs.kind !== kind) {
      continue;
    }
    return attrs;
  }
  return null;
};

const getAdjacentInsertTrackChangeAttrs = (
  doc: any,
  pos: number,
  markType: any
): TrackChangeAttrs | null => {
  try {
    const $pos = doc.resolve(pos);
    return (
      getTrackChangeAttrsFromMarks($pos?.nodeBefore?.marks, markType, "insert") ||
      getTrackChangeAttrsFromMarks($pos?.marks?.(), markType, "insert") ||
      getTrackChangeAttrsFromMarks($pos?.nodeAfter?.marks, markType, "insert") ||
      null
    );
  } catch (_error) {
    return null;
  }
};

const isTrackableChange = (
  oldDoc: any,
  newDoc: any,
  change: Change,
  markType: any,
  adjacentInsertAttrs: TrackChangeAttrs | null = null
) => {
  const isInsertExtension =
    !!adjacentInsertAttrs && change.fromA === change.toA && change.toB > change.fromB;
  const deletedSlice = oldDoc.slice(change.fromA, change.toA);
  const insertedSlice = newDoc.slice(change.fromB, change.toB);
  if ((deletedSlice.openStart || deletedSlice.openEnd) && deletedSlice.size > 0) {
    return false;
  }
  if ((insertedSlice.openStart || insertedSlice.openEnd) && insertedSlice.size > 0) {
    return false;
  }
  if (!isInlineFragment(deletedSlice.content) || !isInlineFragment(insertedSlice.content)) {
    return false;
  }
  if (fragmentHasTrackChangeMark(deletedSlice.content, markType)) {
    return false;
  }
  if (fragmentHasTrackChangeMark(insertedSlice.content, markType) && !isInsertExtension) {
    return false;
  }
  if (
    rangeHasTrackChangeMark({ doc: oldDoc, schema: oldDoc.type.schema }, change.fromA, change.toA) &&
    !isInsertExtension
  ) {
    return false;
  }
  if (change.toA > change.fromA && !isInlineRange(oldDoc, change.fromA, change.toA)) {
    return false;
  }
  if (change.toB > change.fromB && !isInlineRange(newDoc, change.fromB, change.toB)) {
    return false;
  }
  if (change.toA === change.fromA && !isInlinePosition(oldDoc, change.fromA)) {
    return false;
  }
  if (change.toB === change.fromB && !isInlinePosition(newDoc, change.fromB)) {
    return false;
  }
  return true;
};

const cloneTrackChangeAttrs = (attrs: TrackChangeAttrs): TrackChangeAttrs => ({
  changeId: attrs.changeId,
  kind: attrs.kind,
  userId: attrs.userId || null,
  userName: attrs.userName || null,
  createdAt: attrs.createdAt || null,
});

const cloneFragmentWithMark = (fragment: Fragment, mark: any): Fragment => {
  const nextNodes = fragment.content.map((node: any) => node.mark(mark.addToSet(node.marks)));
  return Fragment.fromArray(nextNodes);
};

const mapNewPosToTrackedPos = (pos: number, changes: readonly Change[]) => {
  let shift = 0;
  for (const change of changes) {
    const deletedLen = change.toA - change.fromA;
    const insertedLen = change.toB - change.fromB;
    if (pos < change.fromB) {
      break;
    }
    if (deletedLen > 0 && insertedLen > 0 && pos <= change.toB) {
      return pos + shift + deletedLen;
    }
    if (deletedLen > 0 && insertedLen === 0 && pos === change.fromB) {
      return pos + shift + deletedLen;
    }
    shift += deletedLen;
  }
  return pos + shift;
};

const createMappedSelection = (selection: any, doc: any, changes: readonly Change[]) => {
  const from = Number(selection?.from);
  const to = Number(selection?.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return null;
  }
  const mappedFrom = Math.max(0, Math.min(doc.content.size, mapNewPosToTrackedPos(from, changes)));
  const mappedTo = Math.max(0, Math.min(doc.content.size, mapNewPosToTrackedPos(to, changes)));
  try {
    if (mappedFrom === mappedTo) {
      return Selection.near(doc.resolve(mappedTo), 1);
    }
    return TextSelection.create(doc, Math.min(mappedFrom, mappedTo), Math.max(mappedFrom, mappedTo));
  } catch (_error) {
    return null;
  }
};

const copyTransactionMeta = (target: any, source: any) => {
  const meta = source && typeof source === "object" ? (source as any).meta : null;
  if (!meta || typeof meta !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(meta)) {
    target.setMeta(key, value);
  }
};

const createChangeAttrs = (
  changeId: string,
  kind: TrackChangeAttrs["kind"],
  options: TrackChangesOptions
): TrackChangeAttrs => ({
  changeId,
  kind,
  userId: options.userId || null,
  userName: options.userName || null,
  createdAt: new Date().toISOString(),
});

export const rewriteTransactionAsTrackChanges = ({
  state,
  transaction,
  options,
}: {
  state: any;
  transaction: any;
  options: TrackChangesOptions;
}) => {
  const oldDoc = state?.doc;
  const newDoc = transaction?.doc;
  const markType = oldDoc?.type?.schema?.marks?.trackChange;
  if (!oldDoc || !newDoc || !markType) {
    return null;
  }

  const changeSet = ChangeSet.create(oldDoc).addSteps(newDoc, transaction.mapping.maps, 0);
  const changes = simplifyChanges(changeSet.changes, newDoc).filter((change) => {
    return change.toA > change.fromA || change.toB > change.fromB;
  });
  const resolvedChanges = changes.map((change) => ({
    change,
    adjacentInsertAttrs:
      change.fromA === change.toA && change.toB > change.fromB
        ? getAdjacentInsertTrackChangeAttrs(oldDoc, change.fromA, markType)
        : null,
  }));
  if (resolvedChanges.length === 0) {
    return null;
  }
  if (
    !resolvedChanges.every((entry) =>
      isTrackableChange(oldDoc, newDoc, entry.change, markType, entry.adjacentInsertAttrs)
    )
  ) {
    return null;
  }

  let rewritten = state.tr;
  for (let index = resolvedChanges.length - 1; index >= 0; index -= 1) {
    const { change, adjacentInsertAttrs } = resolvedChanges[index];
    const changeId = adjacentInsertAttrs?.changeId || createTrackChangeId();
    const deletedSlice = oldDoc.slice(change.fromA, change.toA);
    const insertedSlice = newDoc.slice(change.fromB, change.toB);
    const fragments: Fragment[] = [];

    if (change.toA > change.fromA) {
      const deletedMark = markType.create(createChangeAttrs(changeId, "delete", options));
      fragments.push(cloneFragmentWithMark(deletedSlice.content, deletedMark));
    }
    if (change.toB > change.fromB) {
      const insertedMark = markType.create(
        adjacentInsertAttrs ? cloneTrackChangeAttrs(adjacentInsertAttrs) : createChangeAttrs(changeId, "insert", options)
      );
      fragments.push(cloneFragmentWithMark(insertedSlice.content, insertedMark));
    }

    const replacement = fragments.reduce(
      (result, fragment) => result.append(fragment),
      Fragment.empty
    );
    rewritten = rewritten.replace(change.fromA, change.toA, new Slice(replacement, 0, 0));
  }

  copyTransactionMeta(rewritten, transaction);
  rewritten.setTime(transaction.time);
  if (transaction.storedMarksSet) {
    rewritten.setStoredMarks(transaction.storedMarks || null);
  }
  const nextSelection = createMappedSelection(transaction.selection, rewritten.doc, changes);
  if (nextSelection) {
    rewritten.setSelection(nextSelection);
  }
  if (transaction.scrolledIntoView) {
    rewritten.scrollIntoView();
  }

  return markTrackChangeTransaction(rewritten, {
    activeChangeId: null,
  });
};
