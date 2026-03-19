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

export const resolveDraggableNodeRange = (doc: any, pos: any) => {
  if (!doc) {
    return null;
  }
  const docSize = Number(doc?.content?.size ?? 0);
  const resolvedPos = clampDocPos(doc, pos);
  if (!Number.isFinite(resolvedPos) || resolvedPos < 0 || resolvedPos >= docSize) {
    return null;
  }

  let directNode = null;
  try {
    directNode = doc.nodeAt(resolvedPos);
  } catch (_error) {
    directNode = null;
  }

  try {
    const $pos = doc.resolve(resolvedPos);
    let containingCandidate = null;
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth);
      if (!node || node.isText) {
        continue;
      }
      const from = $pos.before(depth);
      const to = from + node.nodeSize;
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to > docSize) {
        continue;
      }
      if (from === resolvedPos) {
        return { node, from, to };
      }
      if (!containingCandidate && from <= resolvedPos && resolvedPos < to) {
        containingCandidate = { node, from, to };
      }
    }
    if (containingCandidate) {
      return containingCandidate;
    }
  } catch (_error) {
    // Fall back to direct node resolution below.
  }

  if (directNode && !directNode.isText) {
    const to = resolvedPos + directNode.nodeSize;
    if (to <= docSize) {
      return {
        node: directNode,
        from: resolvedPos,
        to,
      };
    }
  }

  return null;
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
