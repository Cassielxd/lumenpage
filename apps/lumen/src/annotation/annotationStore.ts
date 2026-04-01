import { reactive } from "vue";
import * as Y from "yjs";

import type {
  AnnotationItem,
  AnnotationNormalizedPoint,
  AnnotationStrokeTool,
  AnnotationTool,
} from "./annotationTypes";

type AnnotationHistoryEntry = AnnotationItem[];

type AnnotationState = {
  active: boolean;
  tool: AnnotationTool;
  color: string;
  lineWidth: number;
  items: AnnotationItem[];
  currentPageIndex: number | null;
  historyDepth: number;
  viewMode: "all" | "mine";
  currentAuthorId: string | null;
  currentAuthorName: string | null;
  currentAuthorColor: string | null;
};

type YjsAnnotationsBinding = {
  doc: Y.Doc;
  field: string;
  items: Y.Array<string>;
  observer: (events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => void;
};

const DEFAULT_HISTORY_LIMIT = 40;

export const DEFAULT_ANNOTATION_COLORS = [
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#0f172a",
];

const clampPositiveNumber = (value: number, fallback: number) => {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return fallback;
  }
  return Math.max(1, Math.min(24, Math.round(nextValue)));
};

const clonePoint = (point: { x: number; y: number }) => ({
  x: Number(point?.x) || 0,
  y: Number(point?.y) || 0,
});

const cloneItem = (item: AnnotationItem): AnnotationItem => {
  if (item.kind === "stroke") {
    return {
      ...item,
      points: Array.isArray(item.points) ? item.points.map(clonePoint) : [],
    };
  }
  return {
    ...item,
    start: clonePoint(item.start),
    end: clonePoint(item.end),
  };
};

const cloneItems = (items: AnnotationItem[]) => items.map(cloneItem);

const isAnnotationTool = (value: unknown): value is AnnotationTool =>
  value === "pen" ||
  value === "highlighter" ||
  value === "line" ||
  value === "rect" ||
  value === "eraser";

const isStrokeTool = (value: unknown): value is AnnotationStrokeTool =>
  value === "pen" || value === "highlighter";

const normalizePoint = (value: unknown): AnnotationNormalizedPoint | null => {
  const x = Number((value as { x?: unknown } | null)?.x);
  const y = Number((value as { y?: unknown } | null)?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
};

const normalizeAnnotationItem = (value: unknown): AnnotationItem | null => {
  const raw = value as Record<string, unknown> | null;
  const id = typeof raw?.id === "string" ? raw.id.trim() : "";
  const pageIndex = Number(raw?.pageIndex);
  const color = typeof raw?.color === "string" ? raw.color.trim() : "";
  const width = Number(raw?.width);
  const opacity = Number(raw?.opacity);
  if (
    !id ||
    !Number.isFinite(pageIndex) ||
    !color ||
    !Number.isFinite(width) ||
    !Number.isFinite(opacity)
  ) {
    return null;
  }

  const base = {
    id,
    pageIndex: Math.max(0, Math.floor(pageIndex)),
    color,
    width: clampPositiveNumber(width, 4),
    opacity: Math.max(0.05, Math.min(1, opacity)),
    authorId: typeof raw?.authorId === "string" ? raw.authorId : null,
    authorName: typeof raw?.authorName === "string" ? raw.authorName : null,
    authorColor: typeof raw?.authorColor === "string" ? raw.authorColor : null,
  };

  if (raw?.kind === "stroke") {
    if (!isStrokeTool(raw.tool)) {
      return null;
    }
    const points = Array.isArray(raw.points)
      ? raw.points
          .map(normalizePoint)
          .filter((point): point is AnnotationNormalizedPoint => point != null)
      : [];
    if (points.length === 0) {
      return null;
    }
    return {
      ...base,
      kind: "stroke",
      tool: raw.tool,
      points,
    };
  }

  if (raw?.kind === "line" || raw?.kind === "rect") {
    const start = normalizePoint(raw.start);
    const end = normalizePoint(raw.end);
    if (!start || !end) {
      return null;
    }
    return {
      ...base,
      kind: raw.kind,
      start,
      end,
    };
  }

  return null;
};

const serializeAnnotationItem = (item: AnnotationItem) => JSON.stringify(cloneItem(item));

const deserializeAnnotationItem = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    return normalizeAnnotationItem(JSON.parse(value));
  } catch (_error) {
    return null;
  }
};

const normalizeAnnotationField = (field: string | null | undefined) => {
  const text = typeof field === "string" ? field.trim() : "";
  return text || "default";
};

const getAnnotationFieldKey = (field: string | null | undefined) =>
  `lumen-annotations:${normalizeAnnotationField(field)}`;

export type AnnotationPersistedState = {
  version: 1;
  tool: AnnotationTool;
  color: string;
  lineWidth: number;
  items: AnnotationItem[];
};

export type AnnotationAuthor = {
  id: string | null;
  name: string | null;
  color: string | null;
};

export const createLumenAnnotationStore = () => {
  const history: AnnotationHistoryEntry[] = [];
  const state = reactive<AnnotationState>({
    active: false,
    tool: "pen",
    color: DEFAULT_ANNOTATION_COLORS[0],
    lineWidth: 4,
    items: [],
    currentPageIndex: null,
    historyDepth: 0,
    viewMode: "all",
    currentAuthorId: null,
    currentAuthorName: null,
    currentAuthorColor: null,
  });
  let yjsBinding: YjsAnnotationsBinding | null = null;

  const syncHistoryDepth = () => {
    state.historyDepth = history.length;
  };

  const replaceItemsState = (nextItems: AnnotationItem[]) => {
    state.items.splice(0, state.items.length, ...cloneItems(nextItems));
  };

  const clearHistory = () => {
    history.splice(0, history.length);
    syncHistoryDepth();
  };

  const pushHistory = () => {
    history.push(cloneItems(state.items));
    while (history.length > DEFAULT_HISTORY_LIMIT) {
      history.shift();
    }
    syncHistoryDepth();
  };

  const listYItems = () => {
    if (!yjsBinding) {
      return [];
    }
    return yjsBinding.items
      .toArray()
      .map(deserializeAnnotationItem)
      .filter((item): item is AnnotationItem => item != null);
  };

  const syncItemsFromYjs = ({ clearHistoryState = false }: { clearHistoryState?: boolean } = {}) => {
    replaceItemsState(listYItems());
    if (clearHistoryState) {
      clearHistory();
    }
  };

  const replaceYItems = (nextItems: AnnotationItem[]) => {
    const binding = yjsBinding;
    if (!binding) {
      return;
    }
    const encodedItems = cloneItems(nextItems).map(serializeAnnotationItem);
    binding.doc.transact(() => {
      if (binding.items.length > 0) {
        binding.items.delete(0, binding.items.length);
      }
      if (encodedItems.length > 0) {
        binding.items.push(encodedItems);
      }
    }, "lumen-annotations:replace");
  };

  const writeItems = (
    nextItems: AnnotationItem[],
    options: { clearHistoryState?: boolean } = {}
  ) => {
    const normalizedItems = cloneItems(nextItems);
    if (yjsBinding) {
      replaceYItems(normalizedItems);
      replaceItemsState(normalizedItems);
    } else {
      replaceItemsState(normalizedItems);
    }
    if (options.clearHistoryState) {
      clearHistory();
    }
  };

  const mutateItems = (mutate: (items: AnnotationItem[]) => void) => {
    const nextItems = cloneItems(state.items);
    pushHistory();
    mutate(nextItems);
    writeItems(nextItems);
  };

  const disconnectYjsBinding = () => {
    if (!yjsBinding) {
      return;
    }
    yjsBinding.items.unobserveDeep(yjsBinding.observer);
    yjsBinding = null;
  };

  const isOwnedByCurrentAuthor = (item: AnnotationItem) => {
    if (!state.currentAuthorId) {
      return true;
    }
    if (!item.authorId) {
      return true;
    }
    return item.authorId === state.currentAuthorId;
  };

  const isVisibleItem = (item: AnnotationItem) => {
    if (state.viewMode !== "mine") {
      return true;
    }
    return isOwnedByCurrentAuthor(item);
  };

  return {
    state,
    palette: DEFAULT_ANNOTATION_COLORS,
    isCollaborationBacked() {
      return yjsBinding != null;
    },
    setCurrentAuthor(author: AnnotationAuthor) {
      state.currentAuthorId =
        typeof author.id === "string" && author.id.trim().length > 0 ? author.id.trim() : null;
      state.currentAuthorName =
        typeof author.name === "string" && author.name.trim().length > 0 ? author.name.trim() : null;
      state.currentAuthorColor =
        typeof author.color === "string" && author.color.trim().length > 0
          ? author.color.trim()
          : null;
    },
    useLocalStore(options: { clear?: boolean } = {}) {
      disconnectYjsBinding();
      if (options.clear === true) {
        writeItems([], { clearHistoryState: true });
      }
    },
    useCollaborationStore(document: unknown, field?: string | null) {
      if (!(document instanceof Y.Doc)) {
        disconnectYjsBinding();
        return false;
      }

      const normalizedField = normalizeAnnotationField(field);
      if (
        yjsBinding?.doc === document &&
        yjsBinding.field === normalizedField
      ) {
        return true;
      }

      disconnectYjsBinding();

      const items = document.getArray<string>(getAnnotationFieldKey(normalizedField));
      const observer = (_events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => {
        syncItemsFromYjs({ clearHistoryState: transaction.local !== true });
      };

      items.observeDeep(observer);
      yjsBinding = {
        doc: document,
        field: normalizedField,
        items,
        observer,
      };
      syncItemsFromYjs({ clearHistoryState: true });
      return true;
    },
    setActive(active: boolean) {
      state.active = active === true;
    },
    toggleActive() {
      state.active = !state.active;
    },
    setTool(tool: AnnotationTool) {
      state.tool = tool;
    },
    setColor(color: string) {
      if (typeof color !== "string" || color.trim().length === 0) {
        return;
      }
      state.color = color.trim();
    },
    setLineWidth(width: number) {
      state.lineWidth = clampPositiveNumber(width, state.lineWidth);
    },
    setCurrentPageIndex(pageIndex: number | null) {
      state.currentPageIndex = Number.isFinite(pageIndex) ? Number(pageIndex) : null;
    },
    setViewMode(mode: "all" | "mine") {
      state.viewMode = mode === "mine" ? "mine" : "all";
    },
    isItemOwnedByCurrentAuthor(item: AnnotationItem) {
      return isOwnedByCurrentAuthor(item);
    },
    isItemVisible(item: AnnotationItem) {
      return isVisibleItem(item);
    },
    getVisibleItems() {
      return state.items.filter(isVisibleItem);
    },
    listAuthors() {
      const authorMap = new Map<string, AnnotationAuthor>();
      for (const item of state.items) {
        const key = item.authorId || item.authorName || item.authorColor || "unknown";
        if (!authorMap.has(key)) {
          authorMap.set(key, {
            id: item.authorId || null,
            name: item.authorName || null,
            color: item.authorColor || null,
          });
        }
      }
      return Array.from(authorMap.values());
    },
    addItem(item: AnnotationItem) {
      mutateItems((items) => {
        items.push(
          cloneItem({
            ...item,
            authorId: item.authorId ?? state.currentAuthorId,
            authorName: item.authorName ?? state.currentAuthorName,
            authorColor: item.authorColor ?? state.currentAuthorColor,
          })
        );
      });
    },
    removeTopmost(predicate: (item: AnnotationItem) => boolean) {
      const reversedIndex = [...state.items]
        .reverse()
        .findIndex((item) => predicate(item) && (!yjsBinding || isOwnedByCurrentAuthor(item)));
      if (reversedIndex < 0) {
        return false;
      }
      const index = state.items.length - reversedIndex - 1;
      mutateItems((items) => {
        items.splice(index, 1);
      });
      return true;
    },
    clearPage(pageIndex: number | null) {
      if (!Number.isFinite(pageIndex)) {
        return false;
      }
      const normalizedPageIndex = Number(pageIndex);
      const hasPageItems = state.items.some((item) => item.pageIndex === normalizedPageIndex);
      if (!hasPageItems) {
        return false;
      }
      mutateItems((items) => {
        const keptItems = items.filter((item) => {
          if (item.pageIndex !== normalizedPageIndex) {
            return true;
          }
          if (!yjsBinding) {
            return false;
          }
          return !isOwnedByCurrentAuthor(item);
        });
        items.splice(0, items.length, ...keptItems);
      });
      return true;
    },
    clearAll() {
      if (state.items.length === 0) {
        return false;
      }
      mutateItems((items) => {
        if (!yjsBinding) {
          items.splice(0, items.length);
          return;
        }
        const keptItems = items.filter((item) => !isOwnedByCurrentAuthor(item));
        items.splice(0, items.length, ...keptItems);
      });
      return true;
    },
    clearMine() {
      const hasMine = state.items.some(isOwnedByCurrentAuthor);
      if (!hasMine) {
        return false;
      }
      mutateItems((items) => {
        const keptItems = items.filter((item) => !isOwnedByCurrentAuthor(item));
        items.splice(0, items.length, ...keptItems);
      });
      return true;
    },
    undo() {
      const snapshot = history.pop();
      syncHistoryDepth();
      if (!snapshot) {
        return false;
      }
      writeItems(snapshot);
      return true;
    },
    snapshot(): AnnotationPersistedState {
      return {
        version: 1,
        tool: state.tool,
        color: state.color,
        lineWidth: state.lineWidth,
        items: cloneItems(state.items),
      };
    },
    hydrate(value: unknown) {
      const raw = value as Partial<AnnotationPersistedState> | null;
      if (!raw || raw.version !== 1) {
        return false;
      }
      const items = Array.isArray(raw.items)
        ? raw.items
            .map(normalizeAnnotationItem)
            .filter((item): item is AnnotationItem => item != null)
        : [];
      writeItems(items, { clearHistoryState: true });
      state.active = false;
      state.tool = isAnnotationTool(raw.tool) ? raw.tool : "pen";
      state.color =
        typeof raw.color === "string" && raw.color.trim().length > 0
          ? raw.color.trim()
          : DEFAULT_ANNOTATION_COLORS[0];
      state.lineWidth = clampPositiveNumber(Number(raw.lineWidth), 4);
      return true;
    },
  };
};

export type LumenAnnotationStore = ReturnType<typeof createLumenAnnotationStore>;
