import { Mark } from "lumenpage-core";
import { sanitizeLinkHref } from "lumenpage-link";
import type { Command } from "lumenpage-state";
import {
  composeMarkRenderAdapters,
  getDefaultMarkRenderAdapter,
} from "lumenpage-render-engine";

type LinkCommandMethods<ReturnType> = {
  setLink: (attributes: { href?: string | null; title?: string | null }) => ReturnType;
  toggleLink: (attributes: { href?: string | null; title?: string | null }) => ReturnType;
  unsetLink: () => ReturnType;
  deleteLinkBackward: () => ReturnType;
  deleteLinkForward: () => ReturnType;
};

declare module "lumenpage-core" {
  interface Commands<ReturnType> {
    link: LinkCommandMethods<ReturnType>;
  }
}

const getLinkMarkFromSet = (marks: readonly any[] | null | undefined, linkType: any) =>
  Array.isArray(marks) ? marks.find((mark) => mark?.type === linkType) || null : null;

const hasEquivalentLinkMark = (marks: readonly any[] | null | undefined, targetMark: any) =>
  Array.isArray(marks) ? marks.some((mark) => typeof targetMark?.eq === "function" && targetMark.eq(mark)) : false;

const normalizeLinkAttributes = (attributes: { href?: string | null; title?: string | null } | null | undefined) => {
  const href = sanitizeLinkHref(attributes?.href) || null;

  if (!href) {
    return null;
  }

  return {
    href,
    title: attributes?.title || null,
  };
};

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
      setLink: (attributes) => ({ commands }) => {
        const next = normalizeLinkAttributes(attributes);
        return next ? commands.setMark(this.name, next) : false;
      },
      toggleLink: (attributes) => ({ commands }) => {
        const next = normalizeLinkAttributes(attributes);
        return next ? commands.toggleMark(this.name, next) : commands.unsetMark(this.name);
      },
      unsetLink: () => ({ commands }) => commands.unsetMark(this.name),
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
    const attrs: Record<string, any> & { href: string; title?: string | null } = {
      ...HTMLAttributes,
      href: sanitizeLinkHref(HTMLAttributes.href) || "#",
    };
    if (!attrs.title) {
      delete attrs.title;
    }
    return ["a", attrs, 0];
  },
});

export default Link;