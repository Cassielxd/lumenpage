import { Mark } from "lumenpage-core";
import { sanitizeLinkHref } from "lumenpage-link";
import type { Command } from "lumenpage-state";
import {
  composeMarkRenderAdapters,
  getDefaultMarkRenderAdapter,
} from "lumenpage-render-engine";

const getLinkMarkFromSet = (marks: readonly any[] | null | undefined, linkType: any) =>
  Array.isArray(marks) ? marks.find((mark) => mark?.type === linkType) || null : null;

const hasEquivalentLinkMark = (marks: readonly any[] | null | undefined, targetMark: any) =>
  Array.isArray(marks) ? marks.some((mark) => typeof targetMark?.eq === "function" && targetMark.eq(mark)) : false;

// link 仍然保持 mark 语义，不改成 inline atom node。
// 这里单独补“整段删除”能力：当光标落在 link 内或 link 边界上时，
// Backspace/Delete 会先解析出当前连续的 link mark 范围，再整体删除。
const getLinkMarkNearCursor = (state: any, direction: "backward" | "forward") => {
  const selection = state?.selection;
  const $from = selection?.$from;
  const linkType = state?.schema?.marks?.link;
  if (!selection?.empty || !$from || !linkType) {
    return null;
  }

  const candidates =
    direction === "backward"
      ? [$from.nodeBefore?.marks, $from.marks?.(), $from.nodeAfter?.marks]
      : [$from.nodeAfter?.marks, $from.marks?.(), $from.nodeBefore?.marks];

  for (const marks of candidates) {
    const mark = getLinkMarkFromSet(marks, linkType);
    if (mark) {
      return mark;
    }
  }

  return null;
};

// 在当前 textblock 内，把“同一个 link mark 的连续片段”聚成 cluster。
// backward 只匹配光标左侧贴住的 link，forward 只匹配右侧贴住的 link，
// 这样可以保证删除方向和原生编辑体验一致。
const resolveLinkDeletionRange = (state: any, direction: "backward" | "forward") => {
  const selection = state?.selection;
  const $from = selection?.$from;
  if (!selection?.empty || !$from?.parent?.isTextblock || !$from.sameParent?.(selection.$to)) {
    return null;
  }

  const targetMark = getLinkMarkNearCursor(state, direction);
  if (!targetMark) {
    return null;
  }

  const anchorOffset = $from.parentOffset;
  const parentStart = $from.start();
  const clusters: Array<{ start: number; end: number }> = [];
  let clusterStart: number | null = null;
  let clusterEnd: number | null = null;

  $from.parent.forEach((child: any, offset: number) => {
    const childHasLink = child?.isInline && hasEquivalentLinkMark(child.marks, targetMark);
    if (!childHasLink) {
      if (clusterStart != null && clusterEnd != null) {
        clusters.push({ start: clusterStart, end: clusterEnd });
      }
      clusterStart = null;
      clusterEnd = null;
      return;
    }

    if (clusterStart == null || clusterEnd == null) {
      clusterStart = offset;
      clusterEnd = offset + child.nodeSize;
      return;
    }

    if (clusterEnd === offset) {
      clusterEnd = offset + child.nodeSize;
      return;
    }

    clusters.push({ start: clusterStart, end: clusterEnd });
    clusterStart = offset;
    clusterEnd = offset + child.nodeSize;
  });

  if (clusterStart != null && clusterEnd != null) {
    clusters.push({ start: clusterStart, end: clusterEnd });
  }

  const matched = clusters.find((cluster) =>
    direction === "backward"
      ? cluster.start < anchorOffset && anchorOffset <= cluster.end
      : cluster.start <= anchorOffset && anchorOffset < cluster.end
  );

  if (!matched) {
    return null;
  }

  return {
    from: parentStart + matched.start,
    to: parentStart + matched.end,
  };
  };

const createDeleteLinkCommand =
  (direction: "backward" | "forward"): Command =>
  (state, dispatch) => {
    // 返回 false 时，外层 keymap/chainCommands 会继续走后面的默认删除逻辑，
    // 因此这里不会吞掉普通文本删除。
    const range = resolveLinkDeletionRange(state, direction);
    if (!range) {
      return false;
    }
    if (dispatch) {
      dispatch(state.tr.delete(range.from, range.to).scrollIntoView());
    }
    return true;
  };

export const Link = Mark.create({
  name: "link",
  priority: 100,
  inclusive: false,
  addCommands() {
    return {
      deleteLinkBackward: () => createDeleteLinkCommand("backward"),
      deleteLinkForward: () => createDeleteLinkCommand("forward"),
    };
  },
  addKeyboardShortcuts() {
    return {
      Backspace: createDeleteLinkCommand("backward"),
      "Shift-Backspace": createDeleteLinkCommand("backward"),
      "Mod-Backspace": createDeleteLinkCommand("backward"),
      Delete: createDeleteLinkCommand("forward"),
      "Mod-Delete": createDeleteLinkCommand("forward"),
    };
  },
  addMarkAdapter() {
    return composeMarkRenderAdapters(getDefaultMarkRenderAdapter("link"), (state, mark) => {
      const href = sanitizeLinkHref(mark?.attrs?.href);
      if (href) {
        state.linkHref = href;
      }
    });
  },
  addMarkAnnotation() {
    return (mark) => {
      const href = sanitizeLinkHref(mark?.attrs?.href);
      if (!href) {
        return null;
      }
      return {
        name: "link",
        key: href,
        group: "link",
        inclusive: false,
        attrs: {
          href,
          title: mark?.attrs?.title || null,
        },
        data: {
          href,
          title: mark?.attrs?.title || null,
        },
      };
    };
  },
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => sanitizeLinkHref(element?.getAttribute?.("href")),
      },
      title: {
        default: null,
        parseHTML: (element) => element?.getAttribute?.("title") || null,
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "a[href]",
        getAttrs: (element) => (sanitizeLinkHref(element?.getAttribute?.("href")) ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = {
      ...HTMLAttributes,
      href: sanitizeLinkHref(HTMLAttributes.href) || "#",
    };
    if (!attrs.title) {
      delete attrs.title;
    }
    return ["a", attrs, 0];
  }
});

export default Link;
