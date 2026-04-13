import { isDocumentLockNode } from "./documentLockMark.js";
import { DOCUMENT_LOCK_NODE_ATTR, markDocumentLockTransaction } from "./types.js";

export const setDocumentLockNodeFlag = (
  tr: any,
  entries: Array<{ pos: number; node: any }>,
  locked: boolean
) => {
  let nextTr = tr;
  for (const entry of [...entries].sort((left, right) => right.pos - left.pos)) {
    if (!entry?.node || !Number.isFinite(entry?.pos)) {
      continue;
    }
    if ((entry.node.attrs?.[DOCUMENT_LOCK_NODE_ATTR] === true) === locked) {
      continue;
    }
    nextTr = nextTr.setNodeMarkup(
      entry.pos,
      undefined,
      {
        ...entry.node.attrs,
        [DOCUMENT_LOCK_NODE_ATTR]: locked,
      },
      entry.node.marks
    );
  }
  return nextTr;
};

export const applyUnlockDocumentLockRanges = (
  state: any,
  dispatch: ((tr: any) => void) | undefined,
  ranges: Array<{ from: number; to: number; kind: "mark" | "node" }>
) => {
  const type = state?.schema?.marks?.documentLock || null;
  if (!type || !state?.tr || ranges.length === 0) {
    return false;
  }
  if (!dispatch) {
    return true;
  }

  let tr = state.tr;
  for (const range of [...ranges].sort((left, right) => right.from - left.from)) {
    if (range.kind === "mark") {
      tr = tr.removeMark(range.from, range.to, type.create());
      continue;
    }
    const node = tr.doc.nodeAt(range.from);
    if (!node || !isDocumentLockNode(node)) {
      continue;
    }
    tr = setDocumentLockNodeFlag(tr, [{ pos: range.from, node }], false);
  }

  dispatch(markDocumentLockTransaction(tr, { refresh: true }).scrollIntoView());
  return true;
};
