type GetView = () => any;
type GetLocaleKey = () => "zh-CN" | "en-US";

import { showToolbarMessage } from "./ui/message";

type PainterSnapshot = {
  marks: any[];
  blockAttrs: Record<string, unknown> | null;
};

const BLOCK_ATTR_KEYS = ["align", "indent", "spacingBefore", "spacingAfter"] as const;

const buildResetParagraphAttrs = (attrs: Record<string, unknown> = {}) => ({
  id: attrs.id ?? null,
  align: "left",
  indent: 0,
  spacingBefore: null,
  spacingAfter: null,
});

const getPainterTexts = (locale: "zh-CN" | "en-US") =>
  locale === "en-US"
    ? {
        armed: "Format copied. Select target content and click format painter again.",
        applied: "Format applied",
      }
    : {
        armed: "已复制格式。请选中目标内容后再次点击格式刷。",
        applied: "已应用格式",
      };

const cloneMarks = (marks: any[]) =>
  (marks || []).map((mark) => mark?.type?.create?.(mark?.attrs || {}) || mark).filter(Boolean);

const captureBlockAttrsFromSelection = (state: any) => {
  const parent = state?.selection?.$from?.parent;
  if (!parent || (parent.type?.name !== "paragraph" && parent.type?.name !== "heading")) {
    return null;
  }
  const next: Record<string, unknown> = {};
  for (const key of BLOCK_ATTR_KEYS) {
    next[key] = parent.attrs?.[key] ?? null;
  }
  return next;
};

const applyBlockAttrsToNode = (
  tr: any,
  node: any,
  pos: number,
  blockAttrs: Record<string, unknown> | null
) => {
  if (!blockAttrs) {
    return tr;
  }
  if (!node?.type?.name) {
    return tr;
  }
  if (node.type.name !== "paragraph" && node.type.name !== "heading") {
    return tr;
  }
  const nextAttrs = { ...(node.attrs || {}) };
  for (const key of BLOCK_ATTR_KEYS) {
    nextAttrs[key] = blockAttrs[key] ?? null;
  }
  return tr.setNodeMarkup(pos, undefined, nextAttrs, node.marks);
};

export const createTextFormatActions = ({
  getView,
  getLocaleKey,
}: {
  getView: GetView;
  getLocaleKey: GetLocaleKey;
}) => {
  let painterSnapshot: PainterSnapshot | null = null;

  const clearFormat = () => {
    const view = getView();
    const state = view?.state;
    if (!view || !state?.tr || !state?.selection || !state?.schema) {
      return false;
    }

    const { from, to, empty, $from } = state.selection;
    let tr = state.tr;
    let changed = false;

    const markTypes = Object.values(state.schema.marks || {});
    for (const markType of markTypes) {
      tr = tr.removeMark(from, to, markType as any);
    }

    if (empty) {
      tr = tr.setStoredMarks([]);
    }

    const paragraphType = state.schema.nodes?.paragraph;
    const resetBlockAt = (node: any, pos: number) => {
      if (!node?.type?.name) {
        return;
      }
      if (node.type.name === "heading" && paragraphType) {
        tr = tr.setNodeMarkup(
          pos,
          paragraphType,
          buildResetParagraphAttrs(node.attrs || {}),
          node.marks
        );
        changed = true;
        return;
      }
      if (node.type.name === "paragraph") {
        tr = tr.setNodeMarkup(
          pos,
          node.type,
          buildResetParagraphAttrs(node.attrs || {}),
          node.marks
        );
        changed = true;
      }
    };

    if (empty) {
      const parentNode = $from?.parent;
      if (parentNode && $from.depth > 0) {
        resetBlockAt(parentNode, $from.before($from.depth));
      }
    } else {
      state.doc.nodesBetween(from, to, (node: any, pos: number) => {
        resetBlockAt(node, pos);
      });
    }

    if (!changed && tr.steps.length === 0 && !tr.storedMarksSet) {
      return false;
    }
    view.dispatch(tr.scrollIntoView());
    return true;
  };

  const toggleFormatPainter = () => {
    const view = getView();
    const state = view?.state;
    if (!view || !state?.tr || !state?.selection || !state?.schema) {
      return false;
    }
    const texts = getPainterTexts(getLocaleKey());

    if (!painterSnapshot) {
      const { from, empty, $from } = state.selection;
      const marks = empty ? state.storedMarks || $from.marks() : state.doc.resolve(from).marks();
      painterSnapshot = {
        marks: cloneMarks(marks || []),
        blockAttrs: captureBlockAttrsFromSelection(state),
      };
      showToolbarMessage(texts.armed, "info");
      return true;
    }

    const { from, to, empty } = state.selection;
    let tr = state.tr;
    const markTypes = Object.values(state.schema.marks || {});
    for (const markType of markTypes) {
      tr = tr.removeMark(from, to, markType as any);
    }

    if (empty) {
      tr = tr.setStoredMarks([]);
      for (const mark of painterSnapshot.marks) {
        tr = tr.addStoredMark(mark);
      }
    } else {
      for (const mark of painterSnapshot.marks) {
        tr = tr.addMark(from, to, mark);
      }
      state.doc.nodesBetween(from, to, (node: any, pos: number) => {
        tr = applyBlockAttrsToNode(tr, node, pos, painterSnapshot?.blockAttrs || null);
      });
    }

    painterSnapshot = null;

    if (tr.steps.length === 0 && !tr.storedMarksSet) {
      return false;
    }
    view.dispatch(tr.scrollIntoView());
    showToolbarMessage(texts.applied, "success");
    return true;
  };

  return {
    clearFormat,
    toggleFormatPainter,
  };
};
