import { Mark } from "lumenpage-core";

import {
  DOCUMENT_LOCK_NODE_ATTR,
  createDefaultDocumentLockOptions,
  type DocumentLockOptions,
  type DocumentLockRange,
} from "./types.js";

const getDocumentLockMarkType = (state: any) => state?.schema?.marks?.documentLock || null;

const isDocumentLockMark = (mark: any, type: any) => mark?.type === type;

const hasDocumentLockNodeAttr = (node: any) =>
  !!node?.attrs && Object.prototype.hasOwnProperty.call(node.attrs, DOCUMENT_LOCK_NODE_ATTR);

export const isDocumentLockableNode = (node: any) =>
  node?.isBlock === true && node?.isAtom === true && hasDocumentLockNodeAttr(node);

export const isDocumentLockNode = (node: any) =>
  isDocumentLockableNode(node) && node?.attrs?.[DOCUMENT_LOCK_NODE_ATTR] === true;

const appendDocumentLockRange = (ranges: DocumentLockRange[], nextRange: DocumentLockRange) => {
  const previousRange = ranges[ranges.length - 1];
  if (
    nextRange.kind === "mark" &&
    previousRange?.kind === "mark" &&
    previousRange.to === nextRange.from
  ) {
    previousRange.to = nextRange.to;
    return;
  }
  ranges.push(nextRange);
};

export const getDocumentLockMarksAtPos = (state: any, pos: number) => {
  const type = getDocumentLockMarkType(state);
  const docSize = Number(state?.doc?.content?.size);
  if (!type || !Number.isFinite(docSize)) {
    return [];
  }

  const clampedPos = Math.max(0, Math.min(docSize, Math.floor(Number(pos) || 0)));
  const probePositions = Array.from(new Set([clampedPos, Math.max(0, clampedPos - 1)]));
  const matches: any[] = [];

  for (const probePos of probePositions) {
    let $pos = null;
    try {
      $pos = state.doc.resolve(probePos);
    } catch (_error) {
      continue;
    }

    const candidates = [
      ...($pos?.marks?.() || []),
      ...($pos?.nodeBefore?.marks || []),
      ...($pos?.nodeAfter?.marks || []),
    ];

    for (const mark of candidates) {
      if (!isDocumentLockMark(mark, type) || matches.includes(mark)) {
        continue;
      }
      matches.push(mark);
    }
  }

  return matches;
};

export const findDocumentLockRanges = (state: any) => {
  const type = getDocumentLockMarkType(state);
  if (!state?.doc?.nodesBetween) {
    return [] as DocumentLockRange[];
  }

  const ranges: DocumentLockRange[] = [];
  state.doc.nodesBetween(0, state.doc.content.size, (node: any, pos: number) => {
    if (type && node?.isInline && Array.isArray(node.marks) && node.marks.length > 0) {
      const from = Number(pos);
      const to = Number(pos + node.nodeSize);
      if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
        if (node.marks.some((mark: any) => isDocumentLockMark(mark, type))) {
          appendDocumentLockRange(ranges, {
            from,
            to,
            kind: "mark",
            nodeType: null,
          });
        }
      }
    }

    if (!isDocumentLockNode(node)) {
      return;
    }

    const from = Number(pos);
    const to = Number(pos + node.nodeSize);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return;
    }

    appendDocumentLockRange(ranges, {
      from,
      to,
      kind: "node",
      nodeType: node?.type?.name || null,
    });
  });

  return ranges;
};

export const findDocumentLockRangesAtPos = (state: any, pos: number) => {
  const resolvedPos = Math.floor(Number(pos) || 0);
  return findDocumentLockRanges(state).filter((range) => resolvedPos > range.from && resolvedPos < range.to);
};

export const isPositionInsideDocumentLock = (state: any, pos: number) =>
  findDocumentLockRangesAtPos(state, pos).length > 0;

export const rangeTouchesDocumentLock = (state: any, from: number, to: number) => {
  const start = Math.max(0, Math.floor(Number(from) || 0));
  const end = Math.max(start, Math.floor(Number(to) || 0));
  if (start === end) {
    return false;
  }
  return findDocumentLockRanges(state).some((range) => range.from < end && range.to > start);
};

export const DocumentLockMark = Mark.create<DocumentLockOptions>({
  name: "documentLock",
  priority: 1000,
  inclusive: false,
  excludes: "",
  addOptions() {
    return createDefaultDocumentLockOptions();
  },
  addMarkAdapter() {
    return (style) => {
      style.textBackground = this.options.lockedBackgroundColor;
      style.backgroundRadius = Math.max(style.backgroundRadius, 3);
      style.backgroundPaddingX = Math.max(style.backgroundPaddingX, 1);
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-document-lock]",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-type": "document-lock",
        "data-document-lock": "true",
      },
      0,
    ];
  },
});

export default DocumentLockMark;
