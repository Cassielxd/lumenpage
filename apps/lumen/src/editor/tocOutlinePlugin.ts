import { Plugin } from "lumenpage-state";

export type TocOutlineItem = {
  id: string;
  level: number;
  text: string;
};

export type TocOutlineSnapshot = {
  items: TocOutlineItem[];
  activeId: string | null;
};

type TocOutlinePluginOptions = {
  onChange?: (snapshot: TocOutlineSnapshot) => void;
  emptyHeadingText?: string;
  initialEnabled?: boolean;
};

type InternalHeading = TocOutlineItem & {
  pos: number;
};

const clampHeadingLevel = (value: unknown) => {
  const level = Math.trunc(Number(value));
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.max(1, Math.min(6, level));
};

const normalizeHeadingText = (node: any, emptyText: string) => {
  const raw = String(node?.textContent || "");
  const text = raw.replace(/\s+/g, " ").trim();
  return text || emptyText;
};

const collectHeadings = (doc: any, emptyText: string): InternalHeading[] => {
  const headings: InternalHeading[] = [];
  if (!doc || typeof doc.descendants !== "function") {
    return headings;
  }
  doc.descendants((node: any, pos: number) => {
    if (node?.type?.name !== "heading") {
      return true;
    }
    const nodeId = node?.attrs?.id;
    if (nodeId == null || nodeId === "") {
      return true;
    }
    headings.push({
      id: String(nodeId),
      level: clampHeadingLevel(node?.attrs?.level),
      text: normalizeHeadingText(node, emptyText),
      pos,
    });
    return true;
  });
  return headings;
};

const resolveActiveHeadingId = (headings: InternalHeading[], headPos: number) => {
  if (!Number.isFinite(headPos) || headings.length === 0) {
    return null;
  }
  let activeId: string | null = null;
  for (const heading of headings) {
    if (heading.pos > headPos) {
      break;
    }
    activeId = heading.id;
  }
  return activeId;
};

const toPublicSnapshot = (headings: InternalHeading[], activeId: string | null): TocOutlineSnapshot => ({
  items: headings.map(({ id, level, text }) => ({ id, level, text })),
  activeId,
});

const snapshotSignature = (snapshot: TocOutlineSnapshot) =>
  `${snapshot.activeId || ""}::${snapshot.items
    .map((item) => `${item.id}|${item.level}|${item.text}`)
    .join("||")}`;

const isDocChanged = (prevState: any, nextState: any) => {
  if (!prevState?.doc || !nextState?.doc) {
    return true;
  }
  if (typeof prevState.doc.eq === "function") {
    return !prevState.doc.eq(nextState.doc);
  }
  return prevState.doc !== nextState.doc;
};

export const findHeadingPosById = (doc: any, id: string): number | null => {
  if (!doc || typeof doc.descendants !== "function" || !id) {
    return null;
  }
  let foundPos: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (node?.type?.name !== "heading") {
      return true;
    }
    if (String(node?.attrs?.id || "") !== id) {
      return true;
    }
    foundPos = pos;
    return false;
  });
  return foundPos;
};

export const createTocOutlinePlugin = (options: TocOutlinePluginOptions = {}) => {
  const emptyHeadingText = String(options.emptyHeadingText || "Untitled").trim() || "Untitled";
  let enabled = options.initialEnabled !== false;
  let syncVisibility: null | (() => void) = null;
  const plugin = new Plugin({
    view(view: any) {
      let headings = collectHeadings(view?.state?.doc, emptyHeadingText);
      let activeId = resolveActiveHeadingId(headings, Number(view?.state?.selection?.head) || 0);
      let lastSignature = "";
      const emitChange = () => {
        const snapshot = enabled
          ? toPublicSnapshot(headings, activeId)
          : { items: [] as TocOutlineItem[], activeId: null };
        const signature = snapshotSignature(snapshot);
        if (signature === lastSignature) {
          return;
        }
        lastSignature = signature;
        options.onChange?.(snapshot);
      };
      syncVisibility = emitChange;
      emitChange();
      return {
        update(nextView: any, prevState: any) {
          const docChanged = isDocChanged(prevState, nextView?.state);
          const nextHead = Number(nextView?.state?.selection?.head);
          const prevHead = Number(prevState?.selection?.head);
          const selectionChanged = nextHead !== prevHead;
          if (!docChanged && !selectionChanged) {
            return;
          }
          if (docChanged) {
            headings = collectHeadings(nextView?.state?.doc, emptyHeadingText);
          }
          activeId = resolveActiveHeadingId(headings, Number.isFinite(nextHead) ? nextHead : 0);
          emitChange();
        },
        destroy() {
          if (syncVisibility === emitChange) {
            syncVisibility = null;
          }
          options.onChange?.({ items: [], activeId: null });
        },
      };
    },
  });
  return {
    plugin,
    setEnabled(nextEnabled: boolean) {
      const normalized = nextEnabled !== false;
      if (enabled === normalized) {
        return;
      }
      enabled = normalized;
      syncVisibility?.();
    },
    isEnabled() {
      return enabled;
    },
  };
};

export type TocOutlinePluginController = ReturnType<typeof createTocOutlinePlugin>;
