import { Mark as MarkExtension } from "lumenpage-core";
import { Fragment } from "lumenpage-model";

import {
  normalizeTrackChangeAttrs,
  normalizeTrackChangeId,
  type TrackChangeAttrs,
  type TrackChangeRange,
  type TrackChangeRecord,
} from "./types.js";

const getTrackChangeMarkType = (state: any) => state?.schema?.marks?.trackChange || null;

const getTrackChangeMarkAttrs = (mark: any): TrackChangeAttrs | null =>
  normalizeTrackChangeAttrs(mark?.attrs);

const getTrackChangeMarksFromSet = (marks: readonly any[] | null | undefined) => {
  if (!Array.isArray(marks) || marks.length === 0) {
    return [];
  }
  return marks
    .map((mark) => ({ mark, attrs: getTrackChangeMarkAttrs(mark) }))
    .filter((entry) => entry.attrs != null);
};

const readInlineNodeText = (node: any) => {
  if (!node) {
    return "";
  }
  if (typeof node.text === "string") {
    return node.text;
  }
  if (typeof node.textContent === "string") {
    return node.textContent;
  }
  return "";
};

const joinExcerpt = (parts: string[], next: string | null) => {
  const text = typeof next === "string" ? next.trim() : "";
  if (!text) {
    return;
  }
  parts.push(text);
};

export const fragmentHasTrackChangeMark = (fragment: Fragment | null | undefined, markType: any) => {
  if (!fragment || !markType || typeof fragment.descendants !== "function") {
    return false;
  }
  let found = false;
  fragment.descendants((node: any) => {
    if (found || !Array.isArray(node?.marks) || node.marks.length === 0) {
      return found ? false : undefined;
    }
    for (const mark of node.marks) {
      if (mark?.type === markType && getTrackChangeMarkAttrs(mark)) {
        found = true;
        return false;
      }
    }
    return undefined;
  });
  return found;
};

export const getTrackChangeMarksAtPos = (state: any, pos: number) => {
  const type = getTrackChangeMarkType(state);
  const docSize = Number(state?.doc?.content?.size);
  if (!type || !Number.isFinite(docSize)) {
    return [];
  }

  const clampedPos = Math.max(0, Math.min(docSize, Math.floor(Number(pos) || 0)));
  const seen = new Set<string>();
  const matches: Array<{ mark: any; attrs: TrackChangeAttrs }> = [];
  const probePositions = Array.from(new Set([clampedPos, Math.max(0, clampedPos - 1)]));

  for (const probePos of probePositions) {
    let $pos = null;
    try {
      $pos = state.doc.resolve(probePos);
    } catch (_error) {
      continue;
    }
    const candidates = [
      ...getTrackChangeMarksFromSet($pos?.marks?.()),
      ...getTrackChangeMarksFromSet($pos?.nodeBefore?.marks),
      ...getTrackChangeMarksFromSet($pos?.nodeAfter?.marks),
    ];
    for (const entry of candidates) {
      if (entry.mark?.type !== type || !entry.attrs) {
        continue;
      }
      const key = `${entry.attrs.changeId}:${entry.attrs.kind}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      matches.push(entry as { mark: any; attrs: TrackChangeAttrs });
    }
  }

  return matches;
};

export const getTrackChangeIdsAtPos = (state: any, pos: number) => {
  const seen = new Set<string>();
  const changeIds: string[] = [];
  for (const entry of getTrackChangeMarksAtPos(state, pos)) {
    const changeId = entry.attrs?.changeId;
    if (!changeId || seen.has(changeId)) {
      continue;
    }
    seen.add(changeId);
    changeIds.push(changeId);
  }
  return changeIds;
};

export const rangeHasTrackChangeMark = (state: any, from: number, to: number) => {
  const type = getTrackChangeMarkType(state);
  if (!type || !state?.doc?.nodesBetween) {
    return false;
  }
  const start = Math.max(0, Math.floor(Number(from) || 0));
  const end = Math.max(start, Math.floor(Number(to) || 0));
  if (start === end) {
    return getTrackChangeMarksAtPos(state, start).length > 0;
  }

  let found = false;
  state.doc.nodesBetween(start, end, (node: any) => {
    if (found || !Array.isArray(node?.marks) || node.marks.length === 0) {
      return found ? false : undefined;
    }
    for (const mark of node.marks) {
      if (mark?.type === type && getTrackChangeMarkAttrs(mark)) {
        found = true;
        return false;
      }
    }
    return undefined;
  });
  return found;
};

export const findTrackChangeRanges = (state: any, changeId?: string | null) => {
  const type = getTrackChangeMarkType(state);
  const targetChangeId = normalizeTrackChangeId(changeId);
  if (!type || !state?.doc?.nodesBetween) {
    return [] as TrackChangeRange[];
  }

  const ranges: TrackChangeRange[] = [];
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
      const attrs = getTrackChangeMarkAttrs(mark);
      if (!attrs) {
        continue;
      }
      if (targetChangeId && attrs.changeId !== targetChangeId) {
        continue;
      }

      const text = readInlineNodeText(node);
      const previous = ranges[ranges.length - 1];
      if (
        previous &&
        previous.changeId === attrs.changeId &&
        previous.kind === attrs.kind &&
        previous.to === from
      ) {
        previous.to = to;
        previous.text = `${previous.text || ""}${text}` || previous.text;
      } else {
        ranges.push({
          ...attrs,
          from,
          to,
          text: text || null,
        });
      }
    }
  });

  return ranges;
};

export const findTrackChangeRange = (state: any, changeId: string | null) =>
  findTrackChangeRanges(state, changeId)[0] || null;

export const listTrackChanges = (state: any) => {
  const ranges = findTrackChangeRanges(state);
  if (ranges.length === 0) {
    return [] as TrackChangeRecord[];
  }

  const grouped = new Map<string, TrackChangeRecord & { insertedParts: string[]; deletedParts: string[] }>();
  for (const range of ranges) {
    const existing = grouped.get(range.changeId);
    if (!existing) {
      const record = {
        changeId: range.changeId,
        from: range.from,
        to: range.to,
        userId: range.userId || null,
        userName: range.userName || null,
        createdAt: range.createdAt || null,
        kinds: [range.kind],
        insertedText: null,
        deletedText: null,
        insertedParts: [] as string[],
        deletedParts: [] as string[],
      };
      if (range.kind === "insert") {
        joinExcerpt(record.insertedParts, range.text);
      } else {
        joinExcerpt(record.deletedParts, range.text);
      }
      grouped.set(range.changeId, record);
      continue;
    }

    existing.from = Math.min(existing.from, range.from);
    existing.to = Math.max(existing.to, range.to);
    if (!existing.userId && range.userId) {
      existing.userId = range.userId;
    }
    if (!existing.userName && range.userName) {
      existing.userName = range.userName;
    }
    if (!existing.createdAt && range.createdAt) {
      existing.createdAt = range.createdAt;
    }
    if (!existing.kinds.includes(range.kind)) {
      existing.kinds.push(range.kind);
    }
    if (range.kind === "insert") {
      joinExcerpt(existing.insertedParts, range.text);
    } else {
      joinExcerpt(existing.deletedParts, range.text);
    }
  }

  return Array.from(grouped.values())
    .map((record) => ({
      changeId: record.changeId,
      from: record.from,
      to: record.to,
      userId: record.userId,
      userName: record.userName,
      createdAt: record.createdAt,
      kinds: record.kinds.slice().sort(),
      insertedText: record.insertedParts.join(" ").trim() || null,
      deletedText: record.deletedParts.join(" ").trim() || null,
    }))
    .sort((left, right) => left.from - right.from);
};

export const TrackChangeMark = MarkExtension.create({
  name: "trackChange",
  priority: 115,
  inclusive: false,
  excludes: "trackChange",
  addMarkAdapter() {
    return (state, mark) => {
      const attrs = getTrackChangeMarkAttrs(mark);
      if (!attrs) {
        return;
      }
      if (attrs.kind === "insert") {
        state.textBackground = "rgba(34, 197, 94, 0.18)";
        state.underline = true;
        state.underlineColor = "#15803d";
        state.backgroundRadius = Math.max(state.backgroundRadius, 3);
        state.backgroundPaddingX = Math.max(state.backgroundPaddingX, 1);
        return;
      }
      state.textBackground = "rgba(239, 68, 68, 0.12)";
      state.textColor = "#b91c1c";
      state.strike = true;
      state.strikeColor = "#dc2626";
      state.backgroundRadius = Math.max(state.backgroundRadius, 3);
      state.backgroundPaddingX = Math.max(state.backgroundPaddingX, 1);
    };
  },
  addMarkAnnotation() {
    return (mark) => {
      const attrs = getTrackChangeMarkAttrs(mark);
      if (!attrs) {
        return null;
      }
      return {
        name: "trackChange",
        key: `track:${attrs.changeId}:${attrs.kind}`,
        group: "trackChange",
        inclusive: false,
        excludes: "trackChange",
        attrs,
        data: attrs,
      };
    };
  },
  addAttributes() {
    return {
      changeId: {
        default: null,
        parseHTML: (element) => normalizeTrackChangeId(element?.getAttribute?.("data-track-change-id")),
        renderHTML: (attrs) => {
          const changeId = normalizeTrackChangeId(attrs.changeId);
          return changeId ? { "data-track-change-id": changeId } : {};
        },
      },
      kind: {
        default: null,
        parseHTML: (element) => {
          const attrs = normalizeTrackChangeAttrs({
            changeId: element?.getAttribute?.("data-track-change-id"),
            kind: element?.getAttribute?.("data-track-change-kind"),
          });
          return attrs?.kind || null;
        },
        renderHTML: (attrs) => {
          const normalized = normalizeTrackChangeAttrs({
            changeId: attrs.changeId,
            kind: attrs.kind,
          });
          return normalized?.kind ? { "data-track-change-kind": normalized.kind } : {};
        },
      },
      userId: {
        default: null,
        parseHTML: (element) => element?.getAttribute?.("data-track-change-user-id") || null,
        renderHTML: (attrs) =>
          attrs.userId ? { "data-track-change-user-id": String(attrs.userId) } : {},
      },
      userName: {
        default: null,
        parseHTML: (element) => element?.getAttribute?.("data-track-change-user-name") || null,
        renderHTML: (attrs) =>
          attrs.userName ? { "data-track-change-user-name": String(attrs.userName) } : {},
      },
      createdAt: {
        default: null,
        parseHTML: (element) => element?.getAttribute?.("data-track-change-created-at") || null,
        renderHTML: (attrs) =>
          attrs.createdAt ? { "data-track-change-created-at": String(attrs.createdAt) } : {},
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-track-change-id][data-track-change-kind]",
        getAttrs: (element) =>
          normalizeTrackChangeAttrs({
            changeId: element?.getAttribute?.("data-track-change-id"),
            kind: element?.getAttribute?.("data-track-change-kind"),
          })
            ? {}
            : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-type": "track-change",
      },
      0,
    ];
  },
});

export default TrackChangeMark;
