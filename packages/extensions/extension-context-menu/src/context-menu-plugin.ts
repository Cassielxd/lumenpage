import type { Editor } from "lumenpage-core";
import {
  Plugin,
  PluginKey,
  NodeSelection,
  Selection,
  type EditorState,
  type Transaction,
} from "lumenpage-state";
import {
  createPopupController,
  createPopupRenderRuntime,
  type PopupController,
  type PopupControllerOptions,
  type PopupRect,
  type PopupRenderLifecycle,
  type PopupRenderRuntime,
} from "lumenpage-popup-runtime";

type ContextMenuCommandHandler = (...args: unknown[]) => boolean;

type ContextMenuCommands = Record<string, ContextMenuCommandHandler | unknown> & {
  can?: (command: string, ...args: unknown[]) => boolean;
};

const getContextMenuCommands = (editor: Editor | null | undefined) =>
  (editor?.commands ?? null) as ContextMenuCommands | null;

export type ContextMenuEditorView = {
  state: EditorState;
  dom: HTMLElement;
  dispatch: (transaction: Transaction) => void;
  focus?: () => void;
  hasFocus?: () => boolean;
  posAtCoords?: (
    coords: { clientX: number; clientY: number } | { left: number; top: number }
  ) => { pos: number; inside?: number } | number | null;
};

export type ContextMenuSelectionSnapshot = {
  from: number;
  to: number;
  empty: boolean;
  type: string | null;
};

export type ContextMenuContext = {
  clientX: number;
  clientY: number;
  rect: PopupRect;
  pos: number | null;
  inside: number | null;
  selection: ContextMenuSelectionSnapshot | null;
  node: unknown | null;
  nodePos: number | null;
};

type ContextMenuPredicateArgs = {
  editor: Editor;
  state: EditorState | null;
  view: ContextMenuEditorView | null;
  context: ContextMenuContext;
};

export type ContextMenuItem = {
  type?: "item";
  id: string;
  label: string;
  command?: string;
  args?: unknown[];
  shortcut?: string;
  danger?: boolean;
  children?: ContextMenuEntry[];
  isEnabled?: (args: ContextMenuPredicateArgs) => boolean;
  isVisible?: (args: ContextMenuPredicateArgs) => boolean;
  run?: (args: ContextMenuPredicateArgs & { item: ContextMenuItem }) => boolean;
};

export type ContextMenuSeparator = {
  type: "separator";
  id: string;
};

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

type ContextMenuEntryInput =
  | ContextMenuEntry
  | {
      type?: unknown;
      id?: unknown;
      label?: unknown;
      command?: unknown;
      args?: unknown;
      shortcut?: unknown;
      danger?: unknown;
      children?: unknown;
      isEnabled?: unknown;
      isVisible?: unknown;
      run?: unknown;
    };

export type ContextMenuItemSource =
  | ContextMenuEntryInput[]
  | ((args: ContextMenuPredicateArgs) => ContextMenuEntryInput[] | Promise<ContextMenuEntryInput[]>);

export type ContextMenuRenderProps = {
  editor: Editor;
  view: ContextMenuEditorView;
  state: EditorState;
  element: HTMLElement;
  ownerDocument: Document;
  popup: PopupController;
  context: ContextMenuContext;
  items: ContextMenuEntry[];
  runItem: (item: ContextMenuItem) => boolean;
  canRunItem: (item: ContextMenuItem) => boolean;
};

export type ContextMenuRenderLifecycle = PopupRenderLifecycle<ContextMenuRenderProps>;

export type ContextMenuShouldShowProps = ContextMenuPredicateArgs;

export type ContextMenuPluginProps = {
  editor: Editor;
  pluginKey?: string | PluginKey;
  element?: HTMLElement | null;
  items?: ContextMenuItemSource;
  render?: (() => ContextMenuRenderLifecycle) | null;
  appendTo?: HTMLElement | (() => HTMLElement | null | undefined);
  shouldShow?: ((props: ContextMenuShouldShowProps) => boolean) | null;
  options?: Omit<PopupControllerOptions, "appendTo">;
  className?: string;
};

const DEFAULT_PLUGIN_KEY = "contextMenu";

const DEFAULT_POPUP_OPTIONS: Omit<PopupControllerOptions, "appendTo"> = {
  placement: "bottom-start",
  offset: [0, 6],
  maxWidth: 260,
  interactive: true,
};

const resolvePluginKeyRef = (pluginKey?: string | PluginKey) => pluginKey || DEFAULT_PLUGIN_KEY;

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const createRectAtClientPoint = (clientX: number, clientY: number): PopupRect => ({
  left: clientX,
  top: clientY,
  right: clientX + 1,
  bottom: clientY + 1,
});

const readSelectionSnapshot = (state: EditorState | null | undefined): ContextMenuSelectionSnapshot | null => {
  const selection = state?.selection;
  if (!selection) {
    return null;
  }
  const jsonType = selection.toJSON?.()?.type ?? null;
  return {
    from: Number(selection.from),
    to: Number(selection.to),
    empty: selection.empty === true,
    type:
      selection instanceof NodeSelection
        ? "NodeSelection"
        : jsonType === "node"
          ? "NodeSelection"
          : jsonType === "text"
            ? "TextSelection"
            : jsonType,
  };
};

const resolveHitResult = (
  view: ContextMenuEditorView,
  event: MouseEvent
): { pos: number | null; inside: number | null } => {
  const raw = view.posAtCoords?.({
    clientX: event.clientX,
    clientY: event.clientY,
  });
  if (typeof raw === "number") {
    return {
      pos: Number.isFinite(raw) ? raw : null,
      inside: null,
    };
  }
  if (!raw || typeof raw !== "object") {
    return { pos: null, inside: null };
  }
  const pos = Number((raw as { pos?: number }).pos);
  const inside = Number((raw as { inside?: number }).inside);
  return {
    pos: Number.isFinite(pos) ? pos : null,
    inside: Number.isFinite(inside) ? inside : null,
  };
};

export const selectionContainsHit = (
  state: EditorState | null | undefined,
  pos: number | null,
  inside: number | null
) => {
  const selection = state?.selection;
  if (!selection) {
    return false;
  }
  if (selection instanceof NodeSelection) {
    return Number.isFinite(inside) && inside === selection.from;
  }
  if (!Number.isFinite(pos)) {
    return false;
  }
  if (selection.empty === true) {
    return Number(selection.from) === pos;
  }
  return pos >= Number(selection.from) && pos <= Number(selection.to);
};

const updateSelectionForContextMenu = (
  view: ContextMenuEditorView,
  pos: number | null,
  inside: number | null
) => {
  const state = view.state;
  const doc = state?.doc;
  const tr = state?.tr;
  if (!doc || !tr || selectionContainsHit(state, pos, inside)) {
    return;
  }

  try {
    let nextSelection = null;
    if (Number.isFinite(inside) && inside != null && inside >= 0) {
      const node = doc.nodeAt(inside);
      if (node && NodeSelection.isSelectable(node)) {
        nextSelection = NodeSelection.create(doc, inside);
      }
    }
    if (!nextSelection) {
      const fallbackPos = Number.isFinite(pos) ? Number(pos) : Number(state.selection?.head ?? 0);
      const clampedPos = Math.max(0, Math.min(doc.content.size, fallbackPos));
      nextSelection = Selection.near(doc.resolve(clampedPos), 1);
    }
    view.dispatch(
      tr.setSelection(nextSelection)
        .setMeta("addToHistory", false)
        .setMeta("contextMenu", true)
    );
  } catch (_error) {
    // Ignore invalid hit positions and fall back to the current selection.
  }
};

export const resolveNodeTarget = (
  state: EditorState | null | undefined,
  pos: number | null,
  inside: number | null
) => {
  const doc = state?.doc;
  if (!doc) {
    return { node: null, nodePos: null };
  }
  if (Number.isFinite(inside) && inside != null && inside >= 0) {
    return {
      node: doc.nodeAt(inside) ?? null,
      nodePos: inside,
    };
  }
  if (!Number.isFinite(pos)) {
    return { node: null, nodePos: null };
  }
  try {
    const $pos = doc.resolve(pos);
    const after = $pos.nodeAfter;
    if (after && NodeSelection.isSelectable(after)) {
      return {
        node: after,
        nodePos: pos,
      };
    }
    const before = $pos.nodeBefore;
    if (before && NodeSelection.isSelectable(before)) {
      return {
        node: before,
        nodePos: pos - before.nodeSize,
      };
    }
  } catch (_error) {
    return { node: null, nodePos: null };
  }
  return { node: null, nodePos: null };
};

const buildContextFromEvent = (view: ContextMenuEditorView, event: MouseEvent): ContextMenuContext => {
  const clientX = toFiniteNumber(event.clientX);
  const clientY = toFiniteNumber(event.clientY);
  const hit = resolveHitResult(view, event);
  updateSelectionForContextMenu(view, hit.pos, hit.inside);
  const state = view.state;
  const { node, nodePos } = resolveNodeTarget(state, hit.pos, hit.inside);
  return {
    clientX,
    clientY,
    rect: createRectAtClientPoint(clientX, clientY),
    pos: hit.pos,
    inside: hit.inside,
    selection: readSelectionSnapshot(state),
    node,
    nodePos,
  };
};

export const normalizeContextMenuEntry = (
  value: ContextMenuEntryInput | null | undefined
): ContextMenuEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (value.type === "separator") {
    const separatorId = String(value.id || "separator").trim();
    return separatorId ? { type: "separator", id: separatorId } : null;
  }

  const record = value as Record<string, unknown>;
  const label = String(record.label || "").trim();
  const id = String(record.id || label).trim();
  const hasRun = typeof record.run === "function";
  const command = String(record.command || "").trim();
  const children = normalizeContextMenuEntries(
    Array.isArray(record.children) ? (record.children as ContextMenuEntryInput[]) : []
  );
  if (!label || !id || (!hasRun && !command && children.length === 0)) {
    return null;
  }

  return {
    type: "item",
    id,
    label,
    command: command || undefined,
    args: Array.isArray(record.args) ? record.args : [],
    shortcut: String(record.shortcut || "").trim() || undefined,
    danger: record.danger === true,
    children: children.length > 0 ? children : undefined,
    isEnabled:
      typeof record.isEnabled === "function"
        ? (record.isEnabled as ContextMenuItem["isEnabled"])
        : undefined,
    isVisible:
      typeof record.isVisible === "function"
        ? (record.isVisible as ContextMenuItem["isVisible"])
        : undefined,
    run: hasRun ? (record.run as ContextMenuItem["run"]) : undefined,
  };
};

export const normalizeContextMenuEntries = (entries: ContextMenuEntryInput[] | null | undefined) => {
  const normalized = (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeContextMenuEntry(entry))
    .filter((entry): entry is ContextMenuEntry => !!entry);
  const compacted: ContextMenuEntry[] = [];
  for (const entry of normalized) {
    const last = compacted[compacted.length - 1] || null;
    if (entry.type === "separator" && (!last || last.type === "separator")) {
      continue;
    }
    compacted.push(entry);
  }
  while (compacted[compacted.length - 1]?.type === "separator") {
    compacted.pop();
  }
  return compacted;
};

const compactVisibleContextMenuEntries = (entries: ContextMenuEntry[]) => {
  const compacted: ContextMenuEntry[] = [];
  for (const entry of entries) {
    if (entry.type === "separator") {
      const last = compacted[compacted.length - 1] || null;
      if (!last || last.type === "separator") {
        continue;
      }
      compacted.push(entry);
      continue;
    }

    const nextChildren = Array.isArray(entry.children)
      ? compactVisibleContextMenuEntries(entry.children)
      : [];
    if (!entry.command && !entry.run && nextChildren.length === 0) {
      continue;
    }

    compacted.push({
      ...entry,
      children: nextChildren.length > 0 ? nextChildren : undefined,
    });
  }
  while (compacted[compacted.length - 1]?.type === "separator") {
    compacted.pop();
  }
  return compacted;
};

export const canRunCommandByEditor = (editor: Editor | null | undefined, item: ContextMenuItem) => {
  if (Array.isArray(item.children) && item.children.length > 0 && !item.command && !item.run) {
    return false;
  }
  if (!item.command) {
    return true;
  }
  const commands = getContextMenuCommands(editor);
  if (!commands) {
    return false;
  }
  if (typeof commands.can === "function") {
    try {
      return commands.can(item.command, ...(item.args || [])) === true;
    } catch (_error) {
      return false;
    }
  }
  return typeof commands[item.command] === "function";
};

export const runContextMenuItemByEditor = (
  editor: Editor | null | undefined,
  view: ContextMenuEditorView | null | undefined,
  item: ContextMenuItem,
  context: ContextMenuContext
) => {
  if (!editor || !view) {
    return false;
  }
  if (typeof item.run === "function") {
    return (
      item.run({
        editor,
        state: view.state,
        view,
        context,
        item,
      }) === true
    );
  }
  const command = item.command ? getContextMenuCommands(editor)?.[item.command] : null;
  if (typeof command !== "function") {
    return false;
  }
  try {
    return command(...(item.args || [])) === true;
  } catch (_error) {
    return false;
  }
};

const defaultShouldShow = ({ editor }: ContextMenuShouldShowProps) => editor.isEditable === true;

const createDefaultContextMenuRenderer = ({
  ownerDocument,
}: {
  ownerDocument: Document;
}): ContextMenuRenderLifecycle => {
  const menuEl = ownerDocument.createElement("div");
  menuEl.style.minWidth = "200px";
  menuEl.style.maxWidth = "260px";
  menuEl.style.padding = "6px";
  menuEl.style.borderRadius = "10px";
  menuEl.style.background = "#ffffff";
  menuEl.style.border = "1px solid rgba(148, 163, 184, 0.28)";
  menuEl.style.boxShadow = "0 16px 40px rgba(15, 23, 42, 0.18)";
  menuEl.style.color = "#0f172a";
  menuEl.style.fontSize = "13px";
  menuEl.style.lineHeight = "1.4";
  menuEl.style.position = "relative";
  menuEl.style.overflow = "visible";

  let currentElement: HTMLElement | null = null;

  const appendItems = (
    container: HTMLElement,
    items: ContextMenuEntry[],
    props: ContextMenuRenderProps
  ) => {
    for (const entry of items) {
      if (entry.type === "separator") {
        const separator = ownerDocument.createElement("div");
        separator.style.height = "1px";
        separator.style.margin = "6px 4px";
        separator.style.background = "rgba(148, 163, 184, 0.18)";
        container.appendChild(separator);
        continue;
      }

      if (Array.isArray(entry.children) && entry.children.length > 0) {
        const shell = ownerDocument.createElement("div");
        shell.style.position = "relative";

        const button = ownerDocument.createElement("button");
        button.type = "button";
        button.style.display = "flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "space-between";
        button.style.width = "100%";
        button.style.padding = "8px 10px";
        button.style.border = "none";
        button.style.borderRadius = "8px";
        button.style.background = "transparent";
        button.style.color = entry.danger ? "#b91c1c" : "#0f172a";
        button.style.cursor = "default";
        button.style.font = "inherit";
        button.style.textAlign = "left";
        button.textContent = entry.label;

        const arrow = ownerDocument.createElement("span");
        arrow.textContent = "›";
        arrow.style.marginLeft = "12px";
        button.appendChild(arrow);
        shell.appendChild(button);

        const submenu = ownerDocument.createElement("div");
        submenu.style.position = "absolute";
        submenu.style.left = "calc(100% + 6px)";
        submenu.style.top = "-6px";
        submenu.style.display = "none";
        submenu.style.minWidth = "200px";
        submenu.style.padding = "6px";
        submenu.style.borderRadius = "10px";
        submenu.style.background = "#ffffff";
        submenu.style.border = "1px solid rgba(148, 163, 184, 0.28)";
        submenu.style.boxShadow = "0 16px 40px rgba(15, 23, 42, 0.18)";
        submenu.style.overflow = "visible";

        shell.addEventListener("mouseenter", () => {
          submenu.style.display = "block";
        });
        shell.addEventListener("mouseleave", () => {
          submenu.style.display = "none";
        });

        appendItems(submenu, entry.children, props);
        shell.appendChild(submenu);
        container.appendChild(shell);
        continue;
      }

      const button = ownerDocument.createElement("button");
      button.type = "button";
      button.textContent = entry.label;
      button.disabled = !props.canRunItem(entry);
      button.style.display = "block";
      button.style.width = "100%";
      button.style.padding = "8px 10px";
      button.style.border = "none";
      button.style.borderRadius = "8px";
      button.style.background = "transparent";
      button.style.color = entry.danger ? "#b91c1c" : "#0f172a";
      button.style.cursor = button.disabled ? "not-allowed" : "pointer";
      button.style.font = "inherit";
      button.style.textAlign = "left";
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", (event) => {
        event.preventDefault();
        if (button.disabled) {
          return;
        }
        props.runItem(entry);
      });
      container.appendChild(button);
    }
  };

  const mount = (props: ContextMenuRenderProps) => {
    currentElement = props.element;
    menuEl.replaceChildren();
    appendItems(menuEl, props.items, props);
    props.popup.show(props.context.rect, props.element);
    if (props.element.firstChild !== menuEl) {
      props.element.replaceChildren(menuEl);
    }
  };

  return {
    onStart: mount,
    onUpdate: mount,
    onExit(props) {
      props.popup.hide();
      currentElement = null;
      props.element.replaceChildren();
    },
    isEventInside(event: Event) {
      const target = event.target as Node | null;
      return !!(target && currentElement?.contains(target));
    },
  };
};

export class ContextMenuView {
  editor: Editor;
  view: ContextMenuEditorView;
  element: HTMLElement;
  popup: PopupController;
  itemsSource: ContextMenuItemSource;
  shouldShow: (props: ContextMenuShouldShowProps) => boolean;
  className?: string;

  private readonly ownerDocument: Document;
  private readonly ownsElement: boolean;
  private readonly renderRuntime: PopupRenderRuntime<ContextMenuRenderProps>;
  private requestId = 0;
  private currentContext: ContextMenuContext | null = null;
  private currentItems: ContextMenuEntry[] = [];
  private isVisible = false;

  constructor({
    editor,
    view,
    element,
    items,
    render,
    appendTo,
    shouldShow,
    options,
    className,
  }: ContextMenuPluginProps & { view: ContextMenuEditorView }) {
    this.editor = editor;
    this.view = view;
    this.itemsSource = items || [];
    this.ownerDocument = view?.dom?.ownerDocument || document;
    this.className = className;
    this.ownsElement = !element;
    this.element = element || this.ownerDocument.createElement("div");
    if (this.ownsElement) {
      this.element.className = this.className || "";
    }
    this.shouldShow = shouldShow || defaultShouldShow;

    this.popup = createPopupController(this.ownerDocument, {
      ...DEFAULT_POPUP_OPTIONS,
      ...(options || {}),
      appendTo,
    });

    this.renderRuntime = createPopupRenderRuntime(
      render?.() || createDefaultContextMenuRenderer({ ownerDocument: this.ownerDocument }),
      () => {
        this.popup.hide();
      }
    );

    this.ownerDocument.addEventListener("pointerdown", this.documentPointerDownHandler, true);
    this.ownerDocument.addEventListener("keydown", this.documentKeyDownHandler, true);
    this.editor.on("transaction", this.transactionHandler);
  }

  private documentPointerDownHandler = (event: Event) => {
    if (this.renderRuntime.isEventInside(event) || this.element.contains(event.target as Node | null)) {
      return;
    }
    this.hide();
  };

  private documentKeyDownHandler = (event: KeyboardEvent) => {
    if (this.renderRuntime.handleKeyDown(event)) {
      return;
    }
    if (event.key === "Escape" || event.key === "Esc") {
      this.hide();
    }
  };

  private transactionHandler = () => {
    if (this.isVisible) {
      this.hide();
    }
  };

  private createPredicateArgs(context: ContextMenuContext): ContextMenuPredicateArgs {
    return {
      editor: this.editor,
      state: this.view?.state ?? null,
      view: this.view,
      context,
    };
  }

  private resolveVisibleItems(context: ContextMenuContext, items: ContextMenuEntry[]) {
    const args = this.createPredicateArgs(context);
    const visibleItems = items
      .map((entry) => {
        if (entry.type === "separator") {
          return entry;
        }
        if (entry.isVisible?.(args) === false) {
          return null;
        }
        return {
          ...entry,
          children: Array.isArray(entry.children)
            ? this.resolveVisibleItems(context, entry.children)
            : undefined,
        };
      })
      .filter((entry): entry is ContextMenuEntry => !!entry);
    return compactVisibleContextMenuEntries(visibleItems);
  }

  private createRenderProps(context: ContextMenuContext, items: ContextMenuEntry[]): ContextMenuRenderProps {
    return {
      editor: this.editor,
      view: this.view,
      state: this.view.state,
      element: this.element,
      ownerDocument: this.ownerDocument,
      popup: this.popup,
      context,
      items,
      canRunItem: (item) => {
        if (Array.isArray(item.children) && item.children.length > 0 && !item.command && !item.run) {
          return false;
        }
        const args = this.createPredicateArgs(context);
        if (item.isEnabled?.(args) === false) {
          return false;
        }
        return canRunCommandByEditor(this.editor, item);
      },
      runItem: (item) => {
        const args = this.createPredicateArgs(context);
        if (item.isEnabled?.(args) === false) {
          return false;
        }
        const executed = runContextMenuItemByEditor(this.editor, this.view, item, context);
        this.hide();
        if (executed) {
          this.view?.focus?.();
        }
        return executed;
      },
    };
  }

  private show(context: ContextMenuContext, items: ContextMenuEntry[]) {
    this.currentContext = context;
    this.currentItems = items;
    this.renderRuntime.update(this.createRenderProps(context, items));
    this.popup.show(context.rect, this.element);
    this.isVisible = true;
  }

  hide() {
    this.requestId += 1;
    if (!this.isVisible) {
      return;
    }
    this.renderRuntime.clear();
    this.popup.hide();
    this.currentContext = null;
    this.currentItems = [];
    this.isVisible = false;
  }

  update(view: ContextMenuEditorView) {
    this.view = view;
  }

  handleContextMenu(view: ContextMenuEditorView, event: MouseEvent) {
    this.view = view;
    const context = buildContextFromEvent(view, event);
    const args = this.createPredicateArgs(context);
    if (this.shouldShow(args) !== true) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const source = this.itemsSource;
    const requestId = ++this.requestId;
    void Promise.resolve(
      Array.isArray(source)
        ? source
        : source({
            editor: this.editor,
            state: view.state,
            view,
            context,
          })
    )
      .catch(() => [])
      .then((resolvedItems) => {
        if (requestId !== this.requestId) {
          return;
        }

        const normalizedItems = this.resolveVisibleItems(
          context,
          normalizeContextMenuEntries(Array.isArray(resolvedItems) ? resolvedItems : [])
        );
        if (normalizedItems.length === 0) {
          this.hide();
          return;
        }

        this.show(context, normalizedItems);
      });

    return true;
  }

  destroy() {
    this.hide();
    this.ownerDocument.removeEventListener("pointerdown", this.documentPointerDownHandler, true);
    this.ownerDocument.removeEventListener("keydown", this.documentKeyDownHandler, true);
    this.editor.off("transaction", this.transactionHandler);
    this.renderRuntime.destroy();
    this.popup.destroy();
  }
}

export const ContextMenuPlugin = (options: ContextMenuPluginProps) => {
  const pluginKeyRef = resolvePluginKeyRef(options.pluginKey);
  const pluginKey =
    pluginKeyRef instanceof PluginKey ? pluginKeyRef : new PluginKey(String(pluginKeyRef));
  let contextMenuView: ContextMenuView | null = null;

  return new Plugin({
    key: pluginKey,
    view: (view) => {
      contextMenuView = new ContextMenuView({
        ...options,
        view: view as ContextMenuEditorView,
      });
      return {
        update(nextView) {
          contextMenuView?.update(nextView as ContextMenuEditorView);
        },
        destroy() {
          contextMenuView?.destroy();
          contextMenuView = null;
        },
      };
    },
    props: {
      handleDOMEvents: {
        contextmenu(view, event) {
          if (!(event instanceof MouseEvent) || !contextMenuView) {
            return false;
          }
          return contextMenuView.handleContextMenu(view as ContextMenuEditorView, event) === true;
        },
      },
    },
  });
};
