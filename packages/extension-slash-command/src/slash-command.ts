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

export type SlashCommandCommandArgs = {
  editor: any;
  view: any;
  range: { from: number; to: number };
  query: string;
};

export type SlashCommandItem = {
  id: string;
  title: string;
  description?: string;
  aliases?: string[];
  keywords?: string[];
  command: (args: SlashCommandCommandArgs) => boolean;
  isEnabled?: (args: { editor: any; state: any; view: any }) => boolean;
};

export type SlashCommandItemSource =
  | SlashCommandItem[]
  | ((args: { query: string; state: any; editor: any }) => SlashCommandItem[] | Promise<SlashCommandItem[]>);

export type SlashCommandOptions = {
  items: SlashCommandItemSource;
  trigger?: string;
  maxItems?: number;
  emptyLabel?: string;
  popupOptions?: PopupControllerOptions;
  suggestion?: Omit<
    SuggestionOptions<SlashCommandItem, SlashCommandItem>,
    "editor" | "pluginKey" | "char" | "items" | "command" | "render"
  >;
  render?: () => SlashCommandRenderLifecycle;
  onSelect?: (args: {
    view: any;
    item: SlashCommandItem;
    query: string;
    range: { from: number; to: number };
  }) => void;
};

type SlashCommandRenderState = {
  active: boolean;
  from: number;
  to: number;
  query: string;
  items: SlashCommandItem[];
  selectedIndex: number;
};

export type SlashCommandRenderProps = SuggestionProps<SlashCommandItem, SlashCommandItem> & {
  view: any;
  state: SlashCommandRenderState;
  trigger: string;
  rect: PopupRect | null;
  ownerDocument: Document;
  popup: PopupController;
  select: (index?: number) => boolean;
  setSelectedIndex: (index: number) => void;
  close: () => boolean;
};

export type SlashCommandRenderLifecycle = {
  onStart?: (props: SlashCommandRenderProps) => void;
  onUpdate?: (props: SlashCommandRenderProps) => void;
  onExit?: (props: SlashCommandRenderProps) => void;
  onKeyDown?: (props: SlashCommandRenderProps & { event: KeyboardEvent }) => boolean;
  isEventInside?: (event: Event) => boolean;
};

const DEFAULT_TRIGGER = "/";
const DEFAULT_MAX_ITEMS = 10;
const DEFAULT_POPUP_OPTIONS: PopupControllerOptions = {
  placement: "bottom-start",
  offset: [0, 4],
  maxWidth: 360,
  interactive: true,
};

export const slashCommandPluginKey = new PluginKey<SuggestionPluginState>("lumen-slash-command");

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

const normalizeSlashCommandItem = (value: any): SlashCommandItem | null => {
  if (!value || typeof value !== "object" || typeof value.command !== "function") {
    return null;
  }

  const title = String(value.title || "").trim();
  const id = String(value.id || title).trim();
  if (!title || !id) {
    return null;
  }

  return {
    id,
    title,
    description: String(value.description || "").trim(),
    aliases: Array.isArray(value.aliases)
      ? value.aliases.map((item: unknown) => String(item || "").trim()).filter(Boolean)
      : [],
    keywords: Array.isArray(value.keywords)
      ? value.keywords.map((item: unknown) => String(item || "").trim()).filter(Boolean)
      : [],
    command: value.command,
    isEnabled: typeof value.isEnabled === "function" ? value.isEnabled : undefined,
  };
};

const buildSearchText = (item: SlashCommandItem) =>
  [
    item.title,
    item.description || "",
    ...(Array.isArray(item.aliases) ? item.aliases : []),
    ...(Array.isArray(item.keywords) ? item.keywords : []),
  ]
    .join(" ")
    .trim()
    .toLowerCase();

const resolveSlashItems = async (
  source: SlashCommandItemSource,
  query: string,
  editor: any,
  maxItems: number
) => {
  const raw = Array.isArray(source) ? source : await Promise.resolve(source({ query, state: editor?.state, editor }));
  const normalized = (Array.isArray(raw) ? raw : [])
    .map((item) => normalizeSlashCommandItem(item))
    .filter((item): item is SlashCommandItem => !!item)
    .filter((item) => item.isEnabled?.({ editor, state: editor?.state, view: editor?.view }) !== false);

  const keyword = String(query || "")
    .trim()
    .toLowerCase();
  const filtered =
    keyword.length === 0
      ? normalized
      : normalized.filter((item) => buildSearchText(item).includes(keyword));

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

const closeSlashPopup = (editor: any) => {
  if (!editor?.view) {
    return false;
  }
  exitSuggestion(editor.view, slashCommandPluginKey);
  return true;
};

const removeSlashQuery = (editor: any, range: { from: number; to: number }) => {
  const view = editor?.view;
  if (!view?.state?.tr || typeof view.dispatch !== "function") {
    return false;
  }
  let tr = view.state.tr.insertText("", range.from, range.to);
  const nextPos = tr.mapping.map(range.from);
  tr = tr.setSelection(TextSelection.create(tr.doc, nextPos));
  view.dispatch(tr.scrollIntoView());
  return true;
};

const applySlashSelection = (
  editor: any,
  options: SlashCommandOptions,
  selected: SlashCommandItem,
  range: { from: number; to: number },
  query: string
) => {
  if (!editor?.view) {
    return false;
  }

  if (!removeSlashQuery(editor, range)) {
    return false;
  }

  const handled =
    selected.command({
      editor,
      view: editor.view,
      range,
      query,
    }) === true;

  if (handled) {
    options.onSelect?.({
      view: editor.view,
      item: selected,
      query,
      range,
    });
  }

  return handled;
};

const createDefaultSlashRenderer = ({
  ownerDocument,
  emptyLabel,
}: {
  ownerDocument: Document;
  emptyLabel?: string;
}): SlashCommandRenderLifecycle => {
  const menuEl = ownerDocument.createElement("div");
  menuEl.className = "lumen-slash-command-menu";
  menuEl.style.minWidth = "260px";
  menuEl.style.maxWidth = "360px";
  menuEl.style.overflow = "hidden";
  menuEl.style.padding = "6px";
  menuEl.style.borderRadius = "10px";
  menuEl.style.background = "#ffffff";
  menuEl.style.border = "1px solid rgba(148, 163, 184, 0.38)";
  menuEl.style.boxShadow = "0 10px 32px rgba(15, 23, 42, 0.16)";
  menuEl.style.fontSize = "13px";
  menuEl.style.lineHeight = "1.4";
  menuEl.style.color = "#0f172a";

  let pointerDownHandler: ((event: Event) => void) | null = null;
  let scrollHandler: (() => void) | null = null;
  let resizeHandler: (() => void) | null = null;
  let currentProps: SlashCommandRenderProps | null = null;

  const renderMenu = (props: SlashCommandRenderProps) => {
    currentProps = props;
    menuEl.replaceChildren();

    if (!props.state.items.length) {
      const emptyState = ownerDocument.createElement("div");
      emptyState.textContent = emptyLabel || "No matching blocks";
      emptyState.style.padding = "10px 12px";
      emptyState.style.color = "#64748b";
      menuEl.appendChild(emptyState);
      props.popup.show(props.clientRect || props.rect, menuEl);
      return;
    }

    props.state.items.forEach((item, index) => {
      const row = ownerDocument.createElement("button");
      row.type = "button";
      row.style.display = "block";
      row.style.width = "100%";
      row.style.border = "none";
      row.style.textAlign = "left";
      row.style.padding = "8px 10px";
      row.style.borderRadius = "8px";
      row.style.background = index === props.state.selectedIndex ? "#e0f2fe" : "transparent";
      row.style.color = "#0f172a";
      row.style.cursor = "pointer";
      row.style.font = "inherit";

      const title = ownerDocument.createElement("div");
      title.textContent = item.title;
      title.style.fontWeight = "600";
      title.style.fontSize = "13px";
      title.style.lineHeight = "1.4";
      row.appendChild(title);

      if (item.description) {
        const description = ownerDocument.createElement("div");
        description.textContent = item.description;
        description.style.marginTop = "2px";
        description.style.fontSize = "12px";
        description.style.lineHeight = "1.35";
        description.style.color = "#64748b";
        row.appendChild(description);
      }

      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      row.addEventListener("click", (event) => {
        event.preventDefault();
        props.select(index);
      });

      menuEl.appendChild(row);
    });

    props.popup.show(props.clientRect || props.rect, menuEl);
  };

  const ensurePointerDownHandler = (props: SlashCommandRenderProps) => {
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

  const removeHandlers = () => {
    if (pointerDownHandler) {
      ownerDocument.removeEventListener("pointerdown", pointerDownHandler, true);
      pointerDownHandler = null;
    }
    if (scrollHandler) {
      ownerDocument.removeEventListener("scroll", scrollHandler, true);
      scrollHandler = null;
    }
    if (resizeHandler) {
      ownerDocument.defaultView?.removeEventListener("resize", resizeHandler as EventListener);
      resizeHandler = null;
    }
  };

  return {
    onStart(props) {
      ensurePointerDownHandler(props);
      ensureRepositionHandlers();
      renderMenu(props);
    },
    onUpdate(props) {
      renderMenu(props);
    },
    onExit(props) {
      removeHandlers();
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

const createSlashRenderer = (
  editor: any,
  options: SlashCommandOptions,
  trigger: string
): SuggestionOptions<SlashCommandItem, SlashCommandItem>["render"] => {
  const ownerDocument = editor?.view?.dom?.ownerDocument || document;
  let popup: PopupController | null = null;
  let selectedIndex = 0;
  let currentSuggestionProps: SuggestionProps<SlashCommandItem, SlashCommandItem> | null = null;
  let currentSlashProps: SlashCommandRenderProps | null = null;

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

  const close = () => closeSlashPopup(editor);

  const buildProps = (
    suggestionProps: SuggestionProps<SlashCommandItem, SlashCommandItem>
  ): SlashCommandRenderProps => {
    currentSuggestionProps = suggestionProps;

    const items = Array.isArray(suggestionProps.items) ? suggestionProps.items : [];
    selectedIndex = clampIndex(selectedIndex, items.length);

    const setSelectedIndex = (nextIndex: number) => {
      selectedIndex = clampIndex(nextIndex, currentSuggestionProps?.items?.length || 0);
      if (!currentSuggestionProps || !currentSlashProps) {
        return;
      }
      currentSlashProps = buildProps(currentSuggestionProps);
      renderer.onUpdate?.(currentSlashProps);
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
      currentSuggestionProps.command(item);
      return true;
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

  const renderer = options.render?.() || createDefaultSlashRenderer({
    ownerDocument,
    emptyLabel: options.emptyLabel,
  });

  return () => ({
    onStart(props) {
      selectedIndex = 0;
      currentSlashProps = buildProps(props);
      renderer.onStart?.(currentSlashProps);
    },
    onUpdate(props) {
      currentSlashProps = buildProps(props);
      renderer.onUpdate?.(currentSlashProps);
    },
    onExit() {
      if (currentSlashProps) {
        renderer.onExit?.(currentSlashProps);
      }
      popup?.destroy();
      popup = null;
      currentSuggestionProps = null;
      currentSlashProps = null;
      selectedIndex = 0;
    },
    onKeyDown({ event }) {
      if (!currentSlashProps) {
        return false;
      }
      return renderer.onKeyDown?.({
        ...currentSlashProps,
        event,
      }) === true;
    },
  });
};

const allowSlashCommand = ({ state, range }: { state: any; range: { from: number; to: number } }) => {
  const selection = state?.selection;
  const $from = selection?.$from;
  const parent = $from?.parent;
  if (!selection?.empty || !parent || parent.type?.name !== "paragraph") {
    return false;
  }
  if (Number($from?.depth) !== 1) {
    return false;
  }
  return range.from === $from.start();
};

export const openSlashCommandPicker = (view: any, trigger = DEFAULT_TRIGGER) => {
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

export const createSlashCommandPlugin = (editor: any, options: SlashCommandOptions) => {
  const trigger = options.trigger || DEFAULT_TRIGGER;
  const maxItems = Number.isFinite(options.maxItems)
    ? Math.max(1, Math.trunc(Number(options.maxItems)))
    : DEFAULT_MAX_ITEMS;

  return Suggestion<SlashCommandItem, SlashCommandItem>({
    pluginKey: slashCommandPluginKey,
    editor,
    char: trigger,
    startOfLine: true,
    items: ({ query, editor: currentEditor }) =>
      resolveSlashItems(options.items, query, currentEditor, maxItems),
    allow: ({ state, range }) => allowSlashCommand({ state, range }),
    command: ({ editor: currentEditor, range, props }) => {
      const slashState = slashCommandPluginKey.getState(currentEditor.view.state);
      const query = slashState?.query || "";
      return applySlashSelection(currentEditor, options, props, range, query);
    },
    render: createSlashRenderer(editor, options, trigger),
    ...(options.suggestion || {}),
  });
};
