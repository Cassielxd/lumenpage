import { NodeSelection, Plugin } from "lumenpage-state";
import {
  createPopupController,
  type PopupController,
  type PopupControllerOptions,
  type PopupRect,
  toPopupRect,
  toViewportPopupRect,
  createPopupRenderRuntime,
  type PopupRenderLifecycle,
} from "lumenpage-extension-popup";

export type SelectionBubbleAction = {
  id: string;
  label: string;
  command: string;
  args?: unknown[];
  markName?: string;
};

export type SelectionBubbleRenderProps = {
  view: any;
  rect: PopupRect;
  ownerDocument: Document;
  popup: PopupController;
  actions: SelectionBubbleAction[];
  runAction: (action: SelectionBubbleAction) => boolean;
  canRunAction: (action: SelectionBubbleAction) => boolean;
  isActionActive: (action: SelectionBubbleAction) => boolean;
};

export type SelectionBubbleRenderLifecycle = PopupRenderLifecycle<SelectionBubbleRenderProps>;

export type SelectionBubblePluginOptions = {
  actions?: SelectionBubbleAction[];
  className?: string;
  placement?: string;
  offset?: [number, number];
  maxWidth?: number;
  hideWhenReadonly?: boolean;
  popupOptions?: PopupControllerOptions;
  render?: () => SelectionBubbleRenderLifecycle;
  shouldShow?: (args: {
    view: any;
    selection: any;
    rect: PopupRect | null;
  }) => boolean;
};

const DEFAULT_ACTIONS: SelectionBubbleAction[] = [
  { id: "bold", label: "B", command: "toggleBold", markName: "bold" },
  { id: "italic", label: "I", command: "toggleItalic", markName: "italic" },
  { id: "underline", label: "U", command: "toggleUnderline", markName: "underline" },
  { id: "strike", label: "S", command: "toggleStrike", markName: "strike" },
  { id: "inline-code", label: "</>", command: "toggleInlineCode", markName: "code" },
];

const DEFAULT_POPUP_OPTIONS: PopupControllerOptions = {
  placement: "top",
  offset: [0, 4],
  maxWidth: 360,
  interactive: true,
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const normalizeOffset = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }
  return [toFiniteNumber(value[0], 0), toFiniteNumber(value[1], 0)];
};

const safeCoordsAtPos = (view: any, pos: number) => {
  if (!view || typeof view.coordsAtPos !== "function" || !Number.isFinite(pos)) {
    return null;
  }
  try {
    return toPopupRect(view.coordsAtPos(pos));
  } catch (_error) {
    return null;
  }
};

const isTextRangeSelection = (selection: any) => {
  if (!selection || selection.empty) {
    return false;
  }
  if (selection instanceof NodeSelection) {
    return false;
  }
  const selectionType = String(selection?.toJSON?.()?.type || "");
  if (
    selectionType === "tableCell" ||
    selectionType === "tableCellSelection" ||
    selectionType === "tableRowSelection" ||
    selectionType === "tableColSelection"
  ) {
    return false;
  }
  const fromParent = selection?.$from?.parent;
  const toParent = selection?.$to?.parent;
  return !!(fromParent?.isTextblock || toParent?.isTextblock);
};

const resolveAnchorRect = (view: any): PopupRect | null => {
  const selection = view?.state?.selection;
  if (!isTextRangeSelection(selection)) {
    return null;
  }

  const rawDocSize = Number(view?.state?.doc?.content?.size);
  const hasDocSize = Number.isFinite(rawDocSize);
  const docSize = hasDocSize ? Math.max(0, rawDocSize) : null;
  const headRaw = Number(selection.head);
  const head = hasDocSize
    ? Math.max(0, Math.min(docSize as number, headRaw))
    : Math.max(0, Number.isFinite(headRaw) ? headRaw : 0);

  const anchor = Number(selection.anchor);
  const preferForward = Number.isFinite(anchor) ? anchor >= head : true;
  const fallbackDelta = preferForward ? -1 : 1;
  const fallbackPos = head + fallbackDelta;
  const reverseFallbackPos = head - fallbackDelta;
  const canTry = (pos: number) =>
    Number.isFinite(pos) && pos >= 0 && (!hasDocSize || pos <= (docSize as number));

  const localRect =
    safeCoordsAtPos(view, head) ||
    (canTry(fallbackPos) ? safeCoordsAtPos(view, fallbackPos) : null) ||
    (canTry(reverseFallbackPos) ? safeCoordsAtPos(view, reverseFallbackPos) : null);

  return toViewportPopupRect(view, localRect);
};

const normalizeActions = (actions?: SelectionBubbleAction[]) => {
  const source = Array.isArray(actions) && actions.length > 0 ? actions : DEFAULT_ACTIONS;
  const normalized: SelectionBubbleAction[] = [];
  for (const action of source) {
    const id = String(action?.id || "").trim();
    const label = String(action?.label || "").trim();
    const command = String(action?.command || "").trim();
    if (!id || !label || !command) {
      continue;
    }
    normalized.push({
      id,
      label,
      command,
      args: Array.isArray(action.args) ? action.args : [],
      markName: String(action?.markName || "").trim() || undefined,
    });
  }
  return normalized.length > 0 ? normalized : DEFAULT_ACTIONS;
};

const canRunActionByView = (view: any, action: SelectionBubbleAction) => {
  const commands = view?.commands;
  if (!commands) {
    return false;
  }
  if (typeof commands.can === "function") {
    try {
      return commands.can(action.command, ...(action.args || [])) === true;
    } catch (_error) {
      return false;
    }
  }
  return typeof commands[action.command] === "function";
};

const runActionByView = (view: any, action: SelectionBubbleAction) => {
  const command = view?.commands?.[action.command];
  if (typeof command !== "function") {
    return false;
  }
  try {
    return command(...(action.args || [])) === true;
  } catch (_error) {
    return false;
  }
};

const isActionMarkActiveByView = (view: any, action: SelectionBubbleAction) => {
  const state = view?.state;
  if (!state?.selection || !action.markName) {
    return false;
  }
  const markType = state?.schema?.marks?.[action.markName];
  if (!markType) {
    return false;
  }
  const selection = state.selection;
  if (selection.empty) {
    const storedMarks = state.storedMarks || selection.$from?.marks?.() || [];
    return storedMarks.some((mark: any) => mark?.type === markType);
  }
  let active = false;
  state.doc.nodesBetween(selection.from, selection.to, (node: any) => {
    if (active) {
      return false;
    }
    if (!node?.isText) {
      return undefined;
    }
    if (markType.isInSet(node.marks || [])) {
      active = true;
      return false;
    }
    return undefined;
  });
  return active;
};

const createBubbleButton = (
  ownerDocument: Document,
  action: SelectionBubbleAction,
  props: SelectionBubbleRenderProps
) => {
  const button = ownerDocument.createElement("button");
  button.type = "button";
  button.textContent = action.label;
  button.style.width = "30px";
  button.style.height = "30px";
  button.style.border = "1px solid transparent";
  button.style.borderRadius = "6px";
  button.style.background = "transparent";
  button.style.color = "#0f172a";
  button.style.fontSize = action.label.length > 2 ? "11px" : "13px";
  button.style.fontWeight = "600";
  button.style.fontFamily = "inherit";
  button.style.lineHeight = "1";
  button.style.cursor = "pointer";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.padding = "0";
  button.style.userSelect = "none";

  const enabled = props.canRunAction(action);
  const active = props.isActionActive(action);
  if (!enabled) {
    button.disabled = true;
    button.style.opacity = "0.4";
    button.style.cursor = "not-allowed";
  } else if (active) {
    button.style.background = "#dbeafe";
    button.style.borderColor = "#93c5fd";
    button.style.color = "#1d4ed8";
  } else {
    button.style.borderColor = "transparent";
  }

  button.addEventListener("mouseenter", () => {
    if (!button.disabled && !active) {
      button.style.background = "#f1f5f9";
      button.style.borderColor = "#cbd5e1";
    }
  });
  button.addEventListener("mouseleave", () => {
    if (!button.disabled && !active) {
      button.style.background = "transparent";
      button.style.borderColor = "transparent";
    }
  });
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (button.disabled) {
      return;
    }
    props.runAction(action);
  });
  return button;
};

const createDefaultSelectionBubbleRenderer = ({
  ownerDocument,
  popup,
  className,
}: {
  ownerDocument: Document;
  popup: PopupController;
  className?: string;
}): SelectionBubbleRenderLifecycle => {
  const menuEl = ownerDocument.createElement("div");
  menuEl.className = className || "lumen-selection-bubble";
  menuEl.style.display = "inline-flex";
  menuEl.style.alignItems = "center";
  menuEl.style.gap = "4px";
  menuEl.style.padding = "6px";
  menuEl.style.borderRadius = "10px";
  menuEl.style.background = "#ffffff";
  menuEl.style.border = "1px solid rgba(148, 163, 184, 0.35)";
  menuEl.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.18)";
  menuEl.style.minHeight = "42px";

  const render = (props: SelectionBubbleRenderProps) => {
    menuEl.innerHTML = "";
    for (const action of props.actions) {
      menuEl.appendChild(createBubbleButton(ownerDocument, action, props));
    }
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

const resolvePopupOptions = (options: SelectionBubblePluginOptions): PopupControllerOptions => {
  const legacyOffset = normalizeOffset(options.offset);
  const legacyOptions: PopupControllerOptions = {};
  if (typeof options.placement === "string" && options.placement.trim().length > 0) {
    legacyOptions.placement = options.placement;
  }
  if (Number.isFinite(options.maxWidth)) {
    legacyOptions.maxWidth = Number(options.maxWidth);
  }
  if (legacyOffset) {
    legacyOptions.offset = legacyOffset;
  }
  return {
    ...DEFAULT_POPUP_OPTIONS,
    ...legacyOptions,
    ...(options.popupOptions || {}),
  };
};

export const createSelectionBubblePlugin = (options: SelectionBubblePluginOptions = {}) =>
  new Plugin({
    view: (view) => {
      let currentView = view;
      const ownerDocument = currentView?.dom?.ownerDocument || document;
      const actions = normalizeActions(options.actions);
      const popup = createPopupController(ownerDocument, resolvePopupOptions(options));
      const renderer =
        options.render?.() ||
        createDefaultSelectionBubbleRenderer({
          ownerDocument,
          popup,
          className: options.className,
        });
      const renderRuntime = createPopupRenderRuntime(renderer, () => {
        popup.hide();
      });

      let syncPopup = () => {};

      const hidePopup = () => {
        renderRuntime.clear();
      };

      const createRenderProps = (rect: PopupRect): SelectionBubbleRenderProps => ({
        view: currentView,
        rect,
        ownerDocument,
        popup,
        actions,
        canRunAction: (action) => canRunActionByView(currentView, action),
        isActionActive: (action) => isActionMarkActiveByView(currentView, action),
        runAction: (action) => {
          const executed = runActionByView(currentView, action);
          if (!executed) {
            return false;
          }
          currentView?.focus?.();
          syncPopup();
          return true;
        },
      });

      syncPopup = () => {
        if (options.hideWhenReadonly !== false && currentView?.editable === false) {
          hidePopup();
          return;
        }
        const selection = (currentView as any)?.state?.selection;
        const rect = resolveAnchorRect(currentView);
        if (
          typeof options.shouldShow === "function" &&
          options.shouldShow({
            view: currentView,
            selection,
            rect,
          }) === false
        ) {
          hidePopup();
          return;
        }
        if (!rect) {
          hidePopup();
          return;
        }

        const nextProps = createRenderProps(rect);
        renderRuntime.update(nextProps);
      };

      const onDocumentPointerDown = (event: Event) => {
        if (renderRuntime.isEventInside(event)) {
          return;
        }
        hidePopup();
      };

      const onDocumentKeyDown = (event: KeyboardEvent) => {
        if (renderRuntime.handleKeyDown(event)) {
          event.preventDefault();
        }
      };

      const onDocumentScroll = () => {
        syncPopup();
      };

      const onWindowResize = () => {
        syncPopup();
      };

      ownerDocument.addEventListener("pointerdown", onDocumentPointerDown, true);
      ownerDocument.addEventListener("keydown", onDocumentKeyDown, true);
      ownerDocument.addEventListener("scroll", onDocumentScroll, true);
      ownerDocument.defaultView?.addEventListener("resize", onWindowResize, { passive: true });

      syncPopup();

      return {
        update(nextView: any) {
          currentView = nextView;
          syncPopup();
        },
        destroy() {
          ownerDocument.removeEventListener("pointerdown", onDocumentPointerDown, true);
          ownerDocument.removeEventListener("keydown", onDocumentKeyDown, true);
          ownerDocument.removeEventListener("scroll", onDocumentScroll, true);
          ownerDocument.defaultView?.removeEventListener("resize", onWindowResize);
          renderRuntime.destroy();
          popup.destroy();
        },
      };
    },
  });
