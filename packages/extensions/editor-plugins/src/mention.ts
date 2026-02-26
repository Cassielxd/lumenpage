import { Plugin, PluginKey, TextSelection } from "lumenpage-state";
import {
  createTippyPopupController,
  type PopupController,
  type PopupControllerOptions,
  type PopupRect,
} from "./popup/tippyPopup";
import { toPopupRect, toViewportPopupRect } from "./popup/coords";

export type MentionItem = {
  id: string;
  label: string;
  value?: string;
};

type MentionItemsSource =
  | MentionItem[]
  | ((args: { query: string; state: any }) => MentionItem[]);

export type MentionPluginOptions = {
  items: MentionItemsSource;
  trigger?: string;
  maxItems?: number;
  appendSpace?: boolean;
  emptyLabel?: string;
  popupOptions?: PopupControllerOptions;
  render?: () => MentionRenderLifecycle;
  onSelect?: (args: {
    view: any;
    item: MentionItem;
    query: string;
    range: { from: number; to: number };
  }) => void;
};

type MentionPluginState = {
  active: boolean;
  from: number;
  to: number;
  query: string;
  items: MentionItem[];
  selectedIndex: number;
};

export type MentionRenderProps = {
  view: any;
  state: MentionPluginState;
  trigger: string;
  rect: PopupRect;
  ownerDocument: Document;
  popup: PopupController;
  select: (index?: number) => boolean;
  close: () => boolean;
};

export type MentionRenderLifecycle = {
  onStart?: (props: MentionRenderProps) => void;
  onUpdate?: (props: MentionRenderProps) => void;
  onExit?: (props: MentionRenderProps) => void;
  onKeyDown?: (props: MentionRenderProps & { event: KeyboardEvent }) => boolean;
  isEventInside?: (event: Event) => boolean;
};

type MentionMetaAction =
  | { type: "open"; from: number; to: number; query: string }
  | { type: "sync"; from: number; to: number; query: string }
  | { type: "close" }
  | { type: "select-index"; index: number };

const DEFAULT_TRIGGER = "@";
const DEFAULT_MAX_ITEMS = 8;
const DEFAULT_POPUP_OPTIONS: PopupControllerOptions = {
  placement: "bottom-start",
  offset: [0, 4],
  maxWidth: 320,
  interactive: true,
};

const EMPTY_STATE: MentionPluginState = {
  active: false,
  from: 0,
  to: 0,
  query: "",
  items: [],
  selectedIndex: 0,
};

export const mentionPluginKey = new PluginKey<MentionPluginState>("lumen-mention");

const clampIndex = (value: number, length: number) => {
  if (!Number.isFinite(value) || length <= 0) {
    return 0;
  }
  const normalized = Math.trunc(value);
  if (normalized < 0) {
    return ((normalized % length) + length) % length;
  }
  return normalized % length;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeMentionItem = (value: any): MentionItem | null => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) {
      return null;
    }
    return { id: text.toLowerCase(), label: text, value: text };
  }
  const label = String(value.label || value.value || "").trim();
  if (!label) {
    return null;
  }
  const id = String(value.id || label).trim();
  return {
    id: id || label.toLowerCase(),
    label,
    value: String(value.value || label).trim() || label,
  };
};

const resolveMentionItems = (
  source: MentionItemsSource,
  query: string,
  state: any,
  maxItems: number
) => {
  const raw = Array.isArray(source) ? source : source({ query, state }) || [];
  const normalized = raw
    .map((item) => normalizeMentionItem(item))
    .filter((item): item is MentionItem => !!item);
  const keyword = String(query || "")
    .trim()
    .toLowerCase();
  const filtered =
    keyword.length === 0
      ? normalized
      : normalized.filter((item) => {
          const label = item.label.toLowerCase();
          const value = String(item.value || "").toLowerCase();
          return label.includes(keyword) || value.includes(keyword);
        });
  return filtered.slice(0, Math.max(1, maxItems));
};

const readMentionMatchFromSelection = (state: any, trigger: string) => {
  const selection = state?.selection;
  if (!selection?.empty || !selection.$from) {
    return null;
  }
  const $from = selection.$from;
  const parent = $from.parent;
  if (!parent?.isTextblock) {
    return null;
  }
  const textBefore = parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const matcher = new RegExp(`(?:^|\\s)${escapeRegExp(trigger)}([\\w\\u4e00-\\u9fa5-]{0,32})$`);
  const match = matcher.exec(textBefore);
  if (!match) {
    return null;
  }
  const query = match[1] || "";
  const from = selection.from - query.length - trigger.length;
  const to = selection.from;
  if (!Number.isFinite(from) || from < 0 || to < from) {
    return null;
  }
  return { from, to, query };
};

const createStateForQuery = (
  nextState: any,
  options: MentionPluginOptions,
  args: { from: number; to: number; query: string },
  previousIndex = 0
): MentionPluginState => {
  const maxItems = Number.isFinite(options.maxItems)
    ? Math.max(1, Math.trunc(Number(options.maxItems)))
    : DEFAULT_MAX_ITEMS;
  const items = resolveMentionItems(options.items, args.query, nextState, maxItems);
  return {
    active: true,
    from: args.from,
    to: args.to,
    query: args.query,
    items,
    selectedIndex: clampIndex(previousIndex, items.length),
  };
};

const closeMentionPopup = (view: any) => {
  if (!view?.state?.tr || typeof view?.dispatch !== "function") {
    return false;
  }
  view.dispatch(view.state.tr.setMeta(mentionPluginKey, { type: "close" } as MentionMetaAction));
  return true;
};

const applyMentionSelection = (view: any, options: MentionPluginOptions, explicitIndex?: number) => {
  if (!view?.state?.tr || typeof view?.dispatch !== "function") {
    return false;
  }
  const mentionState = mentionPluginKey.getState(view.state);
  if (!mentionState?.active || mentionState.items.length === 0) {
    return closeMentionPopup(view);
  }
  const selectedIndex = clampIndex(
    Number.isFinite(explicitIndex as number) ? Number(explicitIndex) : mentionState.selectedIndex,
    mentionState.items.length
  );
  const selected = mentionState.items[selectedIndex];
  if (!selected) {
    return closeMentionPopup(view);
  }
  const trigger = options.trigger || DEFAULT_TRIGGER;
  const mentionText = `${trigger}${String(selected.value || selected.label || "").trim()}`;
  const appendSpace = options.appendSpace !== false;
  const insertedText = appendSpace ? `${mentionText} ` : mentionText;
  const from = mentionState.from;
  const to = mentionState.to;
  const tr = view.state.tr.insertText(insertedText, from, to);
  const cursorPos = from + insertedText.length;
  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  tr.setMeta(mentionPluginKey, { type: "close" } as MentionMetaAction);
  view.dispatch(tr.scrollIntoView());
  options.onSelect?.({
    view,
    item: selected,
    query: mentionState.query,
    range: { from, to },
  });
  return true;
};

const createDefaultMentionRenderer = ({
  ownerDocument,
  trigger,
  emptyLabel,
  popup,
  select,
}: {
  ownerDocument: Document;
  trigger: string;
  emptyLabel?: string;
  popup: PopupController;
  select: (index?: number) => boolean;
}): MentionRenderLifecycle => {
  const menuEl = ownerDocument.createElement("div");
  menuEl.className = "lumen-mention-menu";
  menuEl.style.minWidth = "220px";
  menuEl.style.maxWidth = "320px";
  menuEl.style.maxHeight = "240px";
  menuEl.style.overflowY = "auto";
  menuEl.style.padding = "6px";
  menuEl.style.borderRadius = "8px";
  menuEl.style.background = "#ffffff";
  menuEl.style.border = "1px solid rgba(148, 163, 184, 0.38)";
  menuEl.style.boxShadow = "0 10px 32px rgba(15, 23, 42, 0.16)";
  menuEl.style.fontSize = "13px";
  menuEl.style.lineHeight = "1.4";
  menuEl.style.color = "#0f172a";

  const renderMenu = (mentionState: MentionPluginState) => {
    menuEl.innerHTML = "";
    if (mentionState.items.length === 0) {
      const emptyText = String(emptyLabel || "").trim();
      if (emptyText) {
        const emptyEl = ownerDocument.createElement("div");
        emptyEl.textContent = emptyText;
        emptyEl.style.padding = "8px 10px";
        emptyEl.style.color = "#64748b";
        menuEl.appendChild(emptyEl);
      }
      return;
    }

    mentionState.items.forEach((item, index) => {
      const row = ownerDocument.createElement("button");
      row.type = "button";
      row.textContent = `${trigger}${item.label}`;
      row.style.display = "block";
      row.style.width = "100%";
      row.style.border = "none";
      row.style.textAlign = "left";
      row.style.padding = "8px 10px";
      row.style.borderRadius = "6px";
      row.style.background = index === mentionState.selectedIndex ? "#e0f2fe" : "transparent";
      row.style.color = "#0f172a";
      row.style.cursor = "pointer";
      row.style.font = "inherit";
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      row.addEventListener("click", (event) => {
        event.preventDefault();
        select(index);
      });
      menuEl.appendChild(row);
    });
  };

  const render = (props: MentionRenderProps) => {
    renderMenu(props.state);
    popup.show(props.rect, menuEl);
  };

  return {
    onStart: render,
    onUpdate: render,
    onExit: () => {
      popup.hide();
    },
    isEventInside: (event: Event) => {
      const target = event.target as Node | null;
      return !!(target && menuEl.contains(target));
    },
  };
};

const resolvePopupRect = (view: any, mentionState: MentionPluginState) => {
  const localRect = toPopupRect(view?.coordsAtPos?.(mentionState.to) || view?.coordsAtPos?.(mentionState.from));
  return toViewportPopupRect(view, localRect);
};

export const openMentionPicker = (view: any, trigger = DEFAULT_TRIGGER) => {
  if (!view?.state?.tr || typeof view?.dispatch !== "function") {
    return false;
  }
  const selection = view.state.selection;
  const from = selection?.from ?? 0;
  const to = selection?.to ?? from;
  const tr = view.state.tr.insertText(trigger, from, to);
  const cursorPos = from + trigger.length;
  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  tr.setMeta(mentionPluginKey, {
    type: "open",
    from,
    to: cursorPos,
    query: "",
  } as MentionMetaAction);
  view.dispatch(tr.scrollIntoView());
  return true;
};

export const createMentionPlugin = (options: MentionPluginOptions) => {
  const trigger = options.trigger || DEFAULT_TRIGGER;
  let activeRenderer: MentionRenderLifecycle | null = null;
  let activeRenderProps: MentionRenderProps | null = null;

  return new Plugin<MentionPluginState>({
    key: mentionPluginKey,
    state: {
      init: () => EMPTY_STATE,
      apply: (tr, value, _oldState, newState) => {
        const meta = tr.getMeta(mentionPluginKey) as MentionMetaAction | null;
        if (meta) {
          if (meta.type === "close") {
            return EMPTY_STATE;
          }
          if (meta.type === "select-index") {
            if (!value.active) {
              return value;
            }
            return {
              ...value,
              selectedIndex: clampIndex(meta.index, value.items.length),
            };
          }
          if (meta.type === "open" || meta.type === "sync") {
            const previousIndex =
              value.active && value.query === meta.query ? value.selectedIndex : 0;
            return createStateForQuery(newState, options, meta, previousIndex);
          }
        }

        if (!value.active) {
          return value;
        }
        if (!tr.docChanged && !tr.selectionSet) {
          return value;
        }
        const matched = readMentionMatchFromSelection(newState, trigger);
        if (!matched) {
          return EMPTY_STATE;
        }
        return createStateForQuery(newState, options, matched, value.selectedIndex);
      },
    },
    props: {
      handleTextInput: (view, _from, _to, text, deflt) => {
        const mentionState = mentionPluginKey.getState(view.state as any) || EMPTY_STATE;
        const typedText = String(text || "");
        const shouldIntercept = mentionState.active || typedText.includes(trigger);
        if (!shouldIntercept) {
          return false;
        }

        if (typeof deflt === "function") {
          deflt();
        }

        const matched = readMentionMatchFromSelection(view.state as any, trigger);
        if (!matched) {
          if (mentionState.active) {
            closeMentionPopup(view);
          }
          return true;
        }
        const action: MentionMetaAction = {
          type: mentionState.active ? "sync" : "open",
          from: matched.from,
          to: matched.to,
          query: matched.query,
        };
        view.dispatch((view.state as any).tr.setMeta(mentionPluginKey, action));
        return true;
      },
      handleKeyDown: (view, event) => {
        const mentionState = mentionPluginKey.getState(view.state as any) || EMPTY_STATE;
        if (!mentionState.active) {
          return false;
        }

        if (activeRenderer && activeRenderProps) {
          const handled = activeRenderer.onKeyDown?.({
            ...activeRenderProps,
            event,
          });
          if (handled) {
            return true;
          }
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          const nextIndex = mentionState.selectedIndex + 1;
          view.dispatch(
            (view.state as any).tr.setMeta(mentionPluginKey, {
              type: "select-index",
              index: nextIndex,
            } as MentionMetaAction)
          );
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          const nextIndex = mentionState.selectedIndex - 1;
          view.dispatch(
            (view.state as any).tr.setMeta(mentionPluginKey, {
              type: "select-index",
              index: nextIndex,
            } as MentionMetaAction)
          );
          return true;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          return applyMentionSelection(view, options);
        }

        if (event.key === "Escape") {
          event.preventDefault();
          return closeMentionPopup(view);
        }

        return false;
      },
    },
    view: (view) => {
      let currentView = view;
      const ownerDocument = currentView?.dom?.ownerDocument || document;
      const popup = createTippyPopupController(ownerDocument, {
        ...DEFAULT_POPUP_OPTIONS,
        ...(options.popupOptions || {}),
      });

      const select = (index?: number) => applyMentionSelection(currentView, options, index);
      const close = () => closeMentionPopup(currentView);

      const renderer =
        options.render?.() ||
        createDefaultMentionRenderer({
          ownerDocument,
          trigger,
          emptyLabel: options.emptyLabel,
          popup,
          select,
        });

      activeRenderer = renderer;
      activeRenderProps = null;
      let started = false;

      const exitRenderer = () => {
        if (!started) {
          popup.hide();
          activeRenderProps = null;
          return;
        }
        if (activeRenderProps) {
          renderer.onExit?.(activeRenderProps);
        } else {
          popup.hide();
        }
        started = false;
        activeRenderProps = null;
      };

      const syncPopup = () => {
        const mentionState = mentionPluginKey.getState(currentView.state as any) || EMPTY_STATE;
        if (!mentionState.active) {
          exitRenderer();
          return;
        }
        const rect = resolvePopupRect(currentView, mentionState);
        if (!rect) {
          exitRenderer();
          return;
        }
        const nextRenderProps: MentionRenderProps = {
          view: currentView,
          state: mentionState,
          trigger,
          rect,
          ownerDocument,
          popup,
          select,
          close,
        };
        if (!started) {
          if (typeof renderer.onStart === "function") {
            renderer.onStart(nextRenderProps);
          } else if (typeof renderer.onUpdate === "function") {
            renderer.onUpdate(nextRenderProps);
          }
          started = true;
        } else {
          renderer.onUpdate?.(nextRenderProps);
        }
        activeRenderProps = nextRenderProps;
      };

      const onDocumentPointerDown = (event: Event) => {
        const mentionState = mentionPluginKey.getState(currentView.state as any) || EMPTY_STATE;
        if (!mentionState.active) {
          return;
        }
        if (renderer.isEventInside?.(event)) {
          return;
        }
        const target = event.target as Node | null;
        if (!target) {
          close();
          return;
        }
        const path = (event as any).composedPath?.() as EventTarget[] | undefined;
        if (Array.isArray(path) && path.includes(currentView.dom)) {
          return;
        }
        close();
      };

      ownerDocument.addEventListener("pointerdown", onDocumentPointerDown, true);
      syncPopup();

      return {
        update(nextView: any) {
          currentView = nextView;
          syncPopup();
        },
        destroy() {
          ownerDocument.removeEventListener("pointerdown", onDocumentPointerDown, true);
          exitRenderer();
          popup.destroy();
          if (activeRenderer === renderer) {
            activeRenderer = null;
            activeRenderProps = null;
          }
        },
      };
    },
  });
};
