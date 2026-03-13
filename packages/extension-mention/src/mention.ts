import { PluginKey, TextSelection } from "lumenpage-state";
import {
  createPopupController,
  type PopupController,
  type PopupControllerOptions,
  type PopupRect,
} from "lumenpage-extension-popup";
import {
  Suggestion,
  exitSuggestion,
  type SuggestionOptions,
  type SuggestionPluginState,
  type SuggestionProps,
} from "lumenpage-suggestion";

export type MentionItem = {
  id: string;
  label: string;
  value?: string;
};

type MentionItemsSource =
  | MentionItem[]
  | ((args: { query: string; state: any; editor: any }) => MentionItem[] | Promise<MentionItem[]>);

export type MentionPluginOptions = {
  items: MentionItemsSource;
  trigger?: string;
  maxItems?: number;
  appendSpace?: boolean;
  emptyLabel?: string;
  popupOptions?: PopupControllerOptions;
  suggestion?: Omit<
    SuggestionOptions<MentionItem, MentionItem>,
    "editor" | "pluginKey" | "char" | "items" | "command" | "render"
  >;
  render?: () => MentionRenderLifecycle;
  onSelect?: (args: {
    view: any;
    item: MentionItem;
    query: string;
    range: { from: number; to: number };
  }) => void;
};

type MentionRenderState = {
  active: boolean;
  from: number;
  to: number;
  query: string;
  items: MentionItem[];
  selectedIndex: number;
};

export type MentionRenderProps = SuggestionProps<MentionItem, MentionItem> & {
  view: any;
  state: MentionRenderState;
  trigger: string;
  rect: PopupRect | null;
  ownerDocument: Document;
  popup: PopupController;
  select: (index?: number) => boolean;
  setSelectedIndex: (index: number) => void;
  close: () => boolean;
};

export type MentionRenderLifecycle = {
  onStart?: (props: MentionRenderProps) => void;
  onUpdate?: (props: MentionRenderProps) => void;
  onExit?: (props: MentionRenderProps) => void;
  onKeyDown?: (props: MentionRenderProps & { event: KeyboardEvent }) => boolean;
  isEventInside?: (event: Event) => boolean;
};

const DEFAULT_TRIGGER = "@";
const DEFAULT_MAX_ITEMS = 8;
const DEFAULT_POPUP_OPTIONS: PopupControllerOptions = {
  placement: "bottom-start",
  offset: [0, 4],
  maxWidth: 320,
  interactive: true,
};

export const mentionPluginKey = new PluginKey<SuggestionPluginState>("lumen-mention");

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

const resolveMentionItems = async (
  source: MentionItemsSource,
  query: string,
  editor: any,
  maxItems: number
) => {
  const raw = Array.isArray(source) ? source : await Promise.resolve(source({ query, state: editor?.state, editor }));
  const normalized = (Array.isArray(raw) ? raw : [])
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

const toPopupRectFromClientRect = (value: DOMRect | null | undefined): PopupRect | null => {
  if (!value) {
    return null;
  }
  const left = Number(value.left);
  const top = Number(value.top);
  const right = Number(value.right);
  const bottom = Number(value.bottom);
  if (![left, top, right, bottom].every(Number.isFinite)) {
    return null;
  }
  return { left, top, right, bottom };
};

const closeMentionPopup = (editor: any) => {
  if (!editor?.view) {
    return false;
  }
  exitSuggestion(editor.view, mentionPluginKey);
  return true;
};

const applyMentionSelection = (
  editor: any,
  options: MentionPluginOptions,
  selected: MentionItem,
  range: { from: number; to: number },
  trigger: string
) => {
  if (!editor?.view?.state?.tr || typeof editor.view.dispatch !== "function") {
    return false;
  }

  const mentionState = mentionPluginKey.getState(editor.view.state);
  const mentionText = `${trigger}${String(selected.value || selected.label || "").trim()}`;
  const appendSpace = options.appendSpace !== false;
  const insertedText = appendSpace ? `${mentionText} ` : mentionText;
  const tr = editor.view.state.tr.insertText(insertedText, range.from, range.to);
  const cursorPos = range.from + insertedText.length;

  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  editor.view.dispatch(tr.scrollIntoView());

  options.onSelect?.({
    view: editor.view,
    item: selected,
    query: mentionState?.query || "",
    range,
  });

  return true;
};

const createDefaultMentionRenderer = ({
  ownerDocument,
  emptyLabel,
}: {
  ownerDocument: Document;
  emptyLabel?: string;
}): MentionRenderLifecycle => {
  const menuEl = ownerDocument.createElement("div");
  menuEl.className = "lumen-mention-menu";
  menuEl.style.minWidth = "220px";
  menuEl.style.maxWidth = "320px";
  menuEl.style.overflow = "hidden";
  menuEl.style.padding = "6px";
  menuEl.style.borderRadius = "8px";
  menuEl.style.background = "#ffffff";
  menuEl.style.border = "1px solid rgba(148, 163, 184, 0.38)";
  menuEl.style.boxShadow = "0 10px 32px rgba(15, 23, 42, 0.16)";
  menuEl.style.fontSize = "13px";
  menuEl.style.lineHeight = "1.4";
  menuEl.style.color = "#0f172a";

  let pointerDownHandler: ((event: Event) => void) | null = null;
  let scrollHandler: (() => void) | null = null;
  let resizeHandler: (() => void) | null = null;
  let refreshFrameId: number | null = null;
  let currentProps: MentionRenderProps | null = null;

  const ensurePointerDownHandler = (props: MentionRenderProps) => {
    if (pointerDownHandler) {
      return;
    }
    pointerDownHandler = (event: Event) => {
      const target = event.target as Node | null;
      if (target && menuEl.contains(target)) {
        return;
      }
      props.close();
    };
    ownerDocument.addEventListener("pointerdown", pointerDownHandler, true);
  };

  const ensureRepositionHandlers = () => {
    if (!scrollHandler) {
      scrollHandler = () => {
        if (currentProps) {
          renderMenu(currentProps);
        }
      };
      ownerDocument.addEventListener("scroll", scrollHandler, true);
    }
    if (!resizeHandler) {
      resizeHandler = () => {
        if (currentProps) {
          renderMenu(currentProps);
        }
      };
      ownerDocument.defaultView?.addEventListener("resize", resizeHandler, { passive: true });
    }
  };

  const removePointerDownHandler = () => {
    if (!pointerDownHandler) {
    } else {
      ownerDocument.removeEventListener("pointerdown", pointerDownHandler, true);
      pointerDownHandler = null;
    }
    if (scrollHandler) {
      ownerDocument.removeEventListener("scroll", scrollHandler, true);
      scrollHandler = null;
    }
    if (resizeHandler) {
      ownerDocument.defaultView?.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
    if (refreshFrameId != null && ownerDocument.defaultView) {
      ownerDocument.defaultView.cancelAnimationFrame(refreshFrameId);
      refreshFrameId = null;
    }
  };

  const scheduleDeferredRefresh = () => {
    const defaultView = ownerDocument.defaultView;
    if (!defaultView) {
      return;
    }
    if (refreshFrameId != null) {
      defaultView.cancelAnimationFrame(refreshFrameId);
      refreshFrameId = null;
    }

    let remainingPasses = 2;
    const tick = () => {
      if (!currentProps) {
        refreshFrameId = null;
        return;
      }
      renderMenu(currentProps);
      remainingPasses -= 1;
      if (remainingPasses <= 0) {
        refreshFrameId = null;
        return;
      }
      refreshFrameId = defaultView.requestAnimationFrame(tick);
    };

    refreshFrameId = defaultView.requestAnimationFrame(tick);
  };

  const renderMenu = (props: MentionRenderProps) => {
    currentProps = props;
    menuEl.innerHTML = "";

    if (props.state.items.length === 0) {
      const emptyText = String(emptyLabel || "").trim();
      if (!emptyText) {
        props.popup.hide();
        return;
      }
      const emptyEl = ownerDocument.createElement("div");
      emptyEl.textContent = emptyText;
      emptyEl.style.padding = "8px 10px";
      emptyEl.style.color = "#64748b";
      menuEl.appendChild(emptyEl);
    } else {
      props.state.items.forEach((item, index) => {
        const row = ownerDocument.createElement("button");
        row.type = "button";
        row.textContent = `${props.trigger}${item.label}`;
        row.style.display = "block";
        row.style.width = "100%";
        row.style.border = "none";
        row.style.textAlign = "left";
        row.style.padding = "8px 10px";
        row.style.borderRadius = "6px";
        row.style.background = index === props.state.selectedIndex ? "#e0f2fe" : "transparent";
        row.style.color = "#0f172a";
        row.style.cursor = "pointer";
        row.style.font = "inherit";
        row.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        row.addEventListener("click", (event) => {
          event.preventDefault();
          props.select(index);
        });
        menuEl.appendChild(row);
      });
    }

    props.popup.show(props.clientRect || props.rect, menuEl);
  };

  return {
    onStart(props) {
      ensurePointerDownHandler(props);
      ensureRepositionHandlers();
      renderMenu(props);
      scheduleDeferredRefresh();
    },
    onUpdate: renderMenu,
    onExit(props) {
      removePointerDownHandler();
      props.popup.hide();
      currentProps = null;
    },
    onKeyDown(props) {
      if (props.event.key === "ArrowDown") {
        props.event.preventDefault();
        props.setSelectedIndex(props.state.selectedIndex + 1);
        return true;
      }
      if (props.event.key === "ArrowUp") {
        props.event.preventDefault();
        props.setSelectedIndex(props.state.selectedIndex - 1);
        return true;
      }
      if (props.event.key === "Enter" || props.event.key === "Tab") {
        props.event.preventDefault();
        return props.select();
      }
      if (props.event.key === "Escape" || props.event.key === "Esc") {
        props.event.preventDefault();
        return props.close();
      }
      return false;
    },
    isEventInside(event: Event) {
      const target = event.target as Node | null;
      return !!(target && menuEl.contains(target));
    },
  };
};

const createMentionRenderer = (
  editor: any,
  options: MentionPluginOptions,
  trigger: string
): SuggestionOptions<MentionItem, MentionItem>["render"] => {
  const ownerDocument = editor?.view?.dom?.ownerDocument || document;
  let popup: PopupController | null = null;
  let selectedIndex = 0;
  let currentSuggestionProps: SuggestionProps<MentionItem, MentionItem> | null = null;
  let currentMentionProps: MentionRenderProps | null = null;

  const ensurePopup = () => {
    if (popup) {
      return popup;
    }
    popup = createPopupController(ownerDocument, {
      ...DEFAULT_POPUP_OPTIONS,
      ...(options.popupOptions || {}),
    });
    return popup;
  };

  const close = () => closeMentionPopup(editor);

  const buildMentionProps = (
    suggestionProps: SuggestionProps<MentionItem, MentionItem>
  ): MentionRenderProps => {
    currentSuggestionProps = suggestionProps;

    const items = Array.isArray(suggestionProps.items) ? suggestionProps.items : [];
    selectedIndex = clampIndex(selectedIndex, items.length);

    const setSelectedIndex = (nextIndex: number) => {
      selectedIndex = clampIndex(nextIndex, currentSuggestionProps?.items?.length || 0);
      if (!currentSuggestionProps || !currentMentionProps) {
        return;
      }
      currentMentionProps = buildMentionProps(currentSuggestionProps);
      renderer.onUpdate?.(currentMentionProps);
    };

    const select = (index?: number) => {
      if (!currentSuggestionProps) {
        return false;
      }
      const availableItems = Array.isArray(currentSuggestionProps.items)
        ? currentSuggestionProps.items
        : [];
      if (availableItems.length === 0) {
        return close();
      }
      const resolvedIndex = clampIndex(
        Number.isFinite(index as number) ? Number(index) : selectedIndex,
        availableItems.length
      );
      const item = availableItems[resolvedIndex];
      if (!item) {
        return close();
      }
      return currentSuggestionProps.command(item) !== false;
    };

    return {
      ...suggestionProps,
      view: editor?.view || null,
      state: {
        active: true,
        from: suggestionProps.range.from,
        to: suggestionProps.range.to,
        query: suggestionProps.query,
        items,
        selectedIndex,
      },
      trigger,
      rect: toPopupRectFromClientRect(suggestionProps.clientRect?.() || null),
      ownerDocument,
      popup: ensurePopup(),
      select,
      setSelectedIndex,
      close,
    };
  };

  const renderer = options.render?.() || createDefaultMentionRenderer({
    ownerDocument,
    emptyLabel: options.emptyLabel,
  });

  return () => ({
    onStart(props) {
      selectedIndex = 0;
      currentMentionProps = buildMentionProps(props);
      renderer.onStart?.(currentMentionProps);
    },
    onUpdate(props) {
      currentMentionProps = buildMentionProps(props);
      renderer.onUpdate?.(currentMentionProps);
    },
    onExit() {
      if (currentMentionProps) {
        renderer.onExit?.(currentMentionProps);
      }
      popup?.destroy();
      popup = null;
      currentSuggestionProps = null;
      currentMentionProps = null;
      selectedIndex = 0;
    },
    onKeyDown({ event }) {
      if (!currentMentionProps) {
        return false;
      }
      return renderer.onKeyDown?.({
        ...currentMentionProps,
        event,
      }) === true;
    },
  });
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
  view.dispatch(tr.scrollIntoView());
  return true;
};

export const createMentionPlugin = (editor: any, options: MentionPluginOptions) => {
  const trigger = options.trigger || DEFAULT_TRIGGER;
  const maxItems = Number.isFinite(options.maxItems)
    ? Math.max(1, Math.trunc(Number(options.maxItems)))
    : DEFAULT_MAX_ITEMS;

  return Suggestion<MentionItem, MentionItem>({
    pluginKey: mentionPluginKey,
    editor,
    char: trigger,
    items: ({ query, editor: currentEditor }) =>
      resolveMentionItems(options.items, query, currentEditor, maxItems),
    command: ({ editor: currentEditor, range, props }) =>
      applyMentionSelection(currentEditor, options, props, range, trigger),
    render: createMentionRenderer(editor, options, trigger),
    ...(options.suggestion || {}),
  });
};
