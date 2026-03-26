import { Mark } from "lumenpage-core";

import {
  markCommentTransaction,
  normalizeCommentId,
  type CommentAnchorAttrs,
} from "./types";

type CommentAnchorCommandMethods<ReturnType> = {
  setCommentAnchor: (attrs?: Partial<CommentAnchorAttrs>) => ReturnType;
  unsetCommentAnchor: (threadId?: string | null) => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    commentAnchor: CommentAnchorCommandMethods<ReturnType>;
  }
}

export type CommentAnchorRange = CommentAnchorAttrs & {
  from: number;
  to: number;
};

const getCommentMarkType = (state: any) => state?.schema?.marks?.commentAnchor || null;

const getCommentMarkAttrs = (mark: any): CommentAnchorAttrs | null => {
  const threadId = normalizeCommentId(mark?.attrs?.threadId);
  const anchorId = normalizeCommentId(mark?.attrs?.anchorId);
  if (!threadId || !anchorId) {
    return null;
  }
  return { threadId, anchorId };
};

const getCommentMarksFromSet = (marks: readonly any[] | null | undefined) => {
  if (!Array.isArray(marks) || marks.length === 0) {
    return [];
  }
  return marks
    .map((mark) => ({ mark, attrs: getCommentMarkAttrs(mark) }))
    .filter((entry) => entry.attrs != null);
};

export const getCommentMarksAtPos = (state: any, pos: number) => {
  const type = getCommentMarkType(state);
  const docSize = Number(state?.doc?.content?.size);
  if (!type || !Number.isFinite(docSize)) {
    return [];
  }

  const clampedPos = Math.max(0, Math.min(docSize, Math.floor(Number(pos) || 0)));
  const seen = new Set<string>();
  const matches: Array<{ mark: any; attrs: CommentAnchorAttrs }> = [];
  const probePositions = Array.from(new Set([clampedPos, Math.max(0, clampedPos - 1)]));

  for (const probePos of probePositions) {
    let $pos = null;
    try {
      $pos = state.doc.resolve(probePos);
    } catch (_error) {
      continue;
    }
    const candidates = [
      ...getCommentMarksFromSet($pos?.marks?.()),
      ...getCommentMarksFromSet($pos?.nodeBefore?.marks),
      ...getCommentMarksFromSet($pos?.nodeAfter?.marks),
    ];
    for (const entry of candidates) {
      if (entry.mark?.type !== type || !entry.attrs) {
        continue;
      }
      const key = `${entry.attrs.threadId}:${entry.attrs.anchorId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      matches.push(entry);
    }
  }

  return matches;
};

export const getCommentThreadIdsAtPos = (state: any, pos: number) => {
  const seen = new Set<string>();
  const threadIds: string[] = [];
  for (const entry of getCommentMarksAtPos(state, pos)) {
    const threadId = entry.attrs?.threadId;
    if (!threadId || seen.has(threadId)) {
      continue;
    }
    seen.add(threadId);
    threadIds.push(threadId);
  }
  return threadIds;
};

export const findCommentAnchorRanges = (state: any, threadId?: string | null) => {
  const type = getCommentMarkType(state);
  const targetThreadId = normalizeCommentId(threadId);
  if (!type || !state?.doc?.nodesBetween) {
    return [] as CommentAnchorRange[];
  }

  const ranges: CommentAnchorRange[] = [];
  state.doc.nodesBetween(0, state.doc.content.size, (node: any, pos: number) => {
    if (!node?.isInline || !Array.isArray(node.marks) || node.marks.length === 0) {
      return;
    }

    const from = Number(pos);
    const to = Number(pos + node.nodeSize);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return;
    }

    for (const mark of node.marks) {
      if (mark?.type !== type) {
        continue;
      }
      const attrs = getCommentMarkAttrs(mark);
      if (!attrs) {
        continue;
      }
      if (targetThreadId && attrs.threadId !== targetThreadId) {
        continue;
      }

      const previous = ranges[ranges.length - 1];
      if (
        previous &&
        previous.threadId === attrs.threadId &&
        previous.anchorId === attrs.anchorId &&
        previous.to === from
      ) {
        previous.to = to;
      } else {
        ranges.push({
          ...attrs,
          from,
          to,
        });
      }
    }
  });

  return ranges;
};

export const findCommentAnchorRange = (state: any, threadId: string | null) =>
  findCommentAnchorRanges(state, threadId)[0] || null;

const createSetCommentAnchorCommand =
  (attrs: Partial<CommentAnchorAttrs> | null | undefined) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = getCommentMarkType(state);
    const threadId = normalizeCommentId(attrs?.threadId);
    const anchorId = normalizeCommentId(attrs?.anchorId);
    const from = Number(state?.selection?.from);
    const to = Number(state?.selection?.to);
    const empty = state?.selection?.empty === true;

    if (
      !type ||
      !threadId ||
      !anchorId ||
      empty ||
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      to <= from
    ) {
      return false;
    }

    if (!dispatch) {
      return true;
    }

    const tr = markCommentTransaction(state.tr.addMark(from, to, type.create({ threadId, anchorId })));
    dispatch(tr.scrollIntoView());
    return true;
  };

const createUnsetCommentAnchorCommand =
  (threadId?: string | null) =>
  (state: any, dispatch?: (tr: any) => void) => {
    const type = getCommentMarkType(state);
    if (!type || !state?.doc?.nodesBetween || !state?.tr) {
      return false;
    }

    const targetThreadId = normalizeCommentId(threadId);
    const selectionFrom = Number(state?.selection?.from);
    const selectionTo = Number(state?.selection?.to);
    const docSize = Number(state?.doc?.content?.size) || 0;
    const from =
      state?.selection?.empty === true ? 0 : Math.max(0, Math.min(docSize, Math.floor(selectionFrom)));
    const to =
      state?.selection?.empty === true
        ? docSize
        : Math.max(from, Math.min(docSize, Math.floor(selectionTo)));

    let tr = state.tr;
    let changed = false;

    state.doc.nodesBetween(from, to, (node: any, pos: number) => {
      if (!node?.isInline || !Array.isArray(node.marks) || node.marks.length === 0) {
        return;
      }
      const start = Math.max(from, pos);
      const end = Math.min(to, pos + node.nodeSize);
      if (end <= start) {
        return;
      }
      for (const mark of node.marks) {
        if (mark?.type !== type) {
          continue;
        }
        const attrs = getCommentMarkAttrs(mark);
        if (!attrs) {
          continue;
        }
        if (targetThreadId && attrs.threadId !== targetThreadId) {
          continue;
        }
        tr = tr.removeMark(start, end, mark);
        changed = true;
      }
    });

    if (!changed) {
      return false;
    }
    if (!dispatch) {
      return true;
    }

    dispatch(markCommentTransaction(tr).scrollIntoView());
    return true;
  };

export const CommentAnchor = Mark.create({
  name: "commentAnchor",
  priority: 110,
  inclusive: false,
  excludes: "",
  addCommands() {
    return {
      setCommentAnchor: (attrs?: Partial<CommentAnchorAttrs>) => createSetCommentAnchorCommand(attrs),
      unsetCommentAnchor: (threadId?: string | null) => createUnsetCommentAnchorCommand(threadId),
    };
  },
  addMarkAnnotation() {
    return (mark) => {
      const attrs = getCommentMarkAttrs(mark);
      if (!attrs) {
        return null;
      }
      return {
        name: "commentAnchor",
        key: `comment:${attrs.threadId}:${attrs.anchorId}`,
        group: "comment",
        inclusive: false,
        excludes: "",
        attrs,
        data: attrs,
      };
    };
  },
  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (element) => normalizeCommentId(element?.getAttribute?.("data-comment-thread-id")),
        renderHTML: (attrs) => {
          const threadId = normalizeCommentId(attrs.threadId);
          return threadId ? { "data-comment-thread-id": threadId } : {};
        },
      },
      anchorId: {
        default: null,
        parseHTML: (element) => normalizeCommentId(element?.getAttribute?.("data-comment-anchor-id")),
        renderHTML: (attrs) => {
          const anchorId = normalizeCommentId(attrs.anchorId);
          return anchorId ? { "data-comment-anchor-id": anchorId } : {};
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-comment-thread-id]",
        getAttrs: (element) =>
          normalizeCommentId(element?.getAttribute?.("data-comment-thread-id")) ? {} : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-type": "comment-anchor",
      },
      0,
    ];
  },
});

export default CommentAnchor;
