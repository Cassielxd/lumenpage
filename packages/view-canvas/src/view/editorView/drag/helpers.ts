import { NodeSelection, Selection } from "lumenpage-state";

export const isEditable = (view: any) => view?.editable !== false;

export const clampDocPos = (doc: any, pos: any) => {
  const size = Number(doc?.content?.size ?? 0);
  const nextPos = Number(pos);
  if (!Number.isFinite(nextPos)) {
    return Math.max(0, Math.min(size, 0));
  }
  return Math.max(0, Math.min(size, nextPos));
};

export const resolveDropSelection = (tr: any, insertPos: number, slice: any) => {
  if (!tr?.doc || !Number.isFinite(insertPos)) {
    return tr;
  }
  const mappedStart = clampDocPos(tr.doc, tr.mapping.map(insertPos, -1));
  const mappedAfter = clampDocPos(tr.doc, tr.mapping.map(insertPos, 1));
  const singleAtomNode =
    slice?.openStart === 0 &&
    slice?.openEnd === 0 &&
    Number(slice?.content?.childCount) === 1 &&
    !!slice?.content?.firstChild?.isAtom;
  if (singleAtomNode) {
    try {
      return tr.setSelection(NodeSelection.create(tr.doc, mappedStart));
    } catch (_error) {
      // Fall back to a text-like selection for atom insertion failures.
    }
  }
  try {
    return tr.setSelection(Selection.near(tr.doc.resolve(mappedAfter), 1));
  } catch (_error) {
    return tr;
  }
};

export const isDragCopy = (event: any) => {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform || navigator.userAgent || "" : "";
  const isMac = /Mac|iPhone|iPad|iPod/i.test(platform);
  return isMac ? event.altKey : event.ctrlKey;
};
