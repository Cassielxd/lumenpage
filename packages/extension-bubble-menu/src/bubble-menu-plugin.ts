import type { Editor } from "lumenpage-core";
import { NodeSelection, Plugin, PluginKey } from "lumenpage-state";
import {
  createPopupController,
  toPopupRect,
  toViewportPopupRect,
  type PopupController,
  type PopupControllerOptions,
  type PopupRect,
  type PopupReference,
} from "lumenpage-extension-popup";

export type BubbleMenuAction = {
  id: string;
  label: string;
  command: string;
  args?: unknown[];
  markName?: string;
};

export type BubbleMenuRenderProps = {
  editor: Editor;
  view: any;
  rect: PopupRect;
  ownerDocument: Document;
  popup: PopupController;
  actions: BubbleMenuAction[];
  runAction: (action: BubbleMenuAction) => boolean;
  canRunAction: (action: BubbleMenuAction) => boolean;
  isActionActive: (action: BubbleMenuAction) => boolean;
};

type BubbleMenuVirtualElement = {
  getBoundingClientRect: () => DOMRect | null;
  getClientRects?: () => ArrayLike<DOMRect> | DOMRect[] | null;
};

export type BubbleMenuShouldShowProps = {
  editor: Editor;
  element: HTMLElement;
  view: any;
  state: any;
  oldState?: any;
  from: number;
  to: number;
  rect: PopupRect | null;
};

export type BubbleMenuPluginProps = {
  editor: Editor;
  pluginKey?: string | PluginKey;
  element?: HTMLElement | null;
  updateDelay?: number;
  resizeDelay?: number;
  appendTo?: HTMLElement | (() => HTMLElement | null | undefined);
  getReferencedVirtualElement?: (() => BubbleMenuVirtualElement | null) | undefined;
  shouldShow?: ((props: BubbleMenuShouldShowProps) => boolean) | null;
  options?: Omit<PopupControllerOptions, "appendTo">;
  actions?: BubbleMenuAction[];
  className?: string;
};

type BubbleMenuViewProps = BubbleMenuPluginProps & {
  view: any;
  pluginKeyRef: string | PluginKey;
};

type DefaultBubbleMenuElement = {
  element: HTMLElement;
  update: (props: BubbleMenuRenderProps) => void;
};

export const DEFAULT_BUBBLE_MENU_ACTIONS: BubbleMenuAction[] = [
  { id: "bold", label: "B", command: "toggleBold", markName: "bold" },
  { id: "italic", label: "I", command: "toggleItalic", markName: "italic" },
  { id: "underline", label: "U", command: "toggleUnderline", markName: "underline" },
  { id: "strike", label: "S", command: "toggleStrike", markName: "strike" },
  { id: "inline-code", label: "</>", command: "toggleInlineCode", markName: "code" },
];

const DEFAULT_PLUGIN_KEY = "bubbleMenu";

const DEFAULT_POPUP_OPTIONS: Omit<PopupControllerOptions, "appendTo"> = {
  placement: "top",
  offset: [0, 8],
  maxWidth: 360,
  interactive: true,
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
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

const combinePopupRects = (leftRect: PopupRect | null, rightRect: PopupRect | null): PopupRect | null => {
  if (!leftRect) {
    return rightRect;
  }
  if (!rightRect) {
    return leftRect;
  }

  return {
    left: Math.min(leftRect.left, rightRect.left),
    top: Math.min(leftRect.top, rightRect.top),
    right: Math.max(leftRect.right, rightRect.right),
    bottom: Math.max(leftRect.bottom, rightRect.bottom),
  };
};

const getSelectionRange = (selection: any) => {
  const ranges = Array.isArray(selection?.ranges) && selection.ranges.length > 0 ? selection.ranges : null;
  if (ranges) {
    return {
      from: Math.min(...ranges.map((range: any) => Number(range?.$from?.pos) || 0)),
      to: Math.max(...ranges.map((range: any) => Number(range?.$to?.pos) || 0)),
    };
  }

  const from = Number.isFinite(selection?.from) ? Number(selection.from) : 0;
  const to = Number.isFinite(selection?.to) ? Number(selection.to) : from;
  return { from, to };
};

const resolveSelectionRect = (view: any): PopupRect | null => {
  const selection = view?.state?.selection;
  if (!selection || selection.empty) {
    return null;
  }

  const { from, to } = getSelectionRange(selection);
  const startRect = safeCoordsAtPos(view, from);
  const endPos = Math.max(from, to - 1);
  const endRect = safeCoordsAtPos(view, endPos) || safeCoordsAtPos(view, to);
  const combinedRect = combinePopupRects(startRect, endRect);
  return toViewportPopupRect(view, combinedRect);
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

const normalizeActions = (actions?: BubbleMenuAction[]) => {
  const source =
    Array.isArray(actions) && actions.length > 0 ? actions : DEFAULT_BUBBLE_MENU_ACTIONS;
  const normalized: BubbleMenuAction[] = [];

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

  return normalized.length > 0 ? normalized : DEFAULT_BUBBLE_MENU_ACTIONS;
};

const canRunActionByView = (view: any, action: BubbleMenuAction) => {
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

const runActionByView = (view: any, action: BubbleMenuAction) => {
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

const isActionMarkActiveByView = (view: any, action: BubbleMenuAction) => {
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
  action: BubbleMenuAction,
  props: BubbleMenuRenderProps
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

const createDefaultBubbleMenuElement = ({
  ownerDocument,
  className,
  element,
}: {
  ownerDocument: Document;
  className?: string;
  element?: HTMLElement | null;
}): DefaultBubbleMenuElement => {
  const menuEl = element || ownerDocument.createElement("div");
  menuEl.className = className || "lumen-bubble-menu";
  menuEl.style.display = "inline-flex";
  menuEl.style.alignItems = "center";
  menuEl.style.gap = "4px";
  menuEl.style.padding = "6px";
  menuEl.style.borderRadius = "10px";
  menuEl.style.background = "#ffffff";
  menuEl.style.border = "1px solid rgba(148, 163, 184, 0.35)";
  menuEl.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.18)";
  menuEl.style.minHeight = "42px";

  return {
    element: menuEl,
    update(props) {
      menuEl.innerHTML = "";
      for (const action of props.actions) {
        menuEl.appendChild(createBubbleButton(ownerDocument, action, props));
      }
    },
  };
};

const defaultShouldShow = ({
  editor,
  element,
  view,
  state,
  from,
  to,
}: BubbleMenuShouldShowProps) => {
  const { doc, selection } = state;
  const empty = !!selection?.empty;
  const isEmptyTextBlock = !doc?.textBetween?.(from, to)?.length && isTextRangeSelection(selection);
  const ownerDocument = element.ownerDocument;
  const activeElement = ownerDocument.activeElement;
  const isChildOfMenu = !!(activeElement && element.contains(activeElement));
  const hasEditorFocus =
    view?.hasFocus?.() === true || editor.isFocused === true || isChildOfMenu;

  if (!hasEditorFocus || empty || isEmptyTextBlock || !editor.isEditable) {
    return false;
  }

  return isTextRangeSelection(selection);
};

export class BubbleMenuView {
  editor: Editor;
  view: any;
  element: HTMLElement;
  popup: PopupController;
  shouldShow: (props: BubbleMenuShouldShowProps) => boolean;
  getReferencedVirtualElement?: (() => BubbleMenuVirtualElement | null) | undefined;
  updateDelay: number;
  resizeDelay: number;
  pluginKeyRef: string | PluginKey;
  defaultElementRuntime: DefaultBubbleMenuElement | null;
  actions: BubbleMenuAction[];

  private updateDebounceTimer: number | undefined;
  private resizeDebounceTimer: number | undefined;
  private preventHide = false;
  private isVisible = false;
  private readonly ownerDocument: Document;
  private readonly useDefaultRenderer: boolean;

  constructor({
    editor,
    view,
    element,
    pluginKeyRef,
    actions,
    className,
    updateDelay = 250,
    resizeDelay = 60,
    appendTo,
    getReferencedVirtualElement,
    options,
    shouldShow,
  }: BubbleMenuViewProps) {
    this.editor = editor;
    this.view = view;
    this.pluginKeyRef = pluginKeyRef;
    this.updateDelay = Math.max(0, toFiniteNumber(updateDelay, 250));
    this.resizeDelay = Math.max(0, toFiniteNumber(resizeDelay, 60));
    this.getReferencedVirtualElement = getReferencedVirtualElement;
    this.ownerDocument = view?.dom?.ownerDocument || document;
    this.useDefaultRenderer = !element || Array.isArray(actions);
    this.actions = this.useDefaultRenderer ? normalizeActions(actions) : [];

    this.defaultElementRuntime = this.useDefaultRenderer
      ? createDefaultBubbleMenuElement({
          ownerDocument: this.ownerDocument,
          className,
          element: element || undefined,
        })
      : null;
    this.element = this.defaultElementRuntime?.element || element!;
    this.element.tabIndex = 0;

    this.shouldShow = shouldShow || defaultShouldShow;
    this.popup = createPopupController(this.ownerDocument, {
      ...DEFAULT_POPUP_OPTIONS,
      ...(options || {}),
      appendTo,
    });

    this.element.addEventListener("mousedown", this.mousedownHandler, true);
    this.view?.dom?.addEventListener?.("dragstart", this.dragstartHandler);
    this.ownerDocument.addEventListener("pointerdown", this.documentPointerDownHandler, true);
    this.ownerDocument.addEventListener("keydown", this.documentKeyDownHandler, true);
    this.ownerDocument.addEventListener("scroll", this.resizeHandler, true);
    this.ownerDocument.defaultView?.addEventListener("resize", this.resizeHandler, { passive: true });
    this.editor.on("focus", this.focusHandler);
    this.editor.on("blur", this.blurHandler);
    this.editor.on("transaction", this.transactionHandler);

    this.update(view);
  }

  private mousedownHandler = () => {
    this.preventHide = true;
  };

  private dragstartHandler = () => {
    this.hide();
  };

  private documentPointerDownHandler = (event: Event) => {
    if (this.element.contains(event.target as Node | null)) {
      return;
    }
    this.hide();
  };

  private documentKeyDownHandler = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.hide();
    }
  };

  private focusHandler = () => {
    const defaultView = this.ownerDocument.defaultView;
    if (!defaultView) {
      this.update(this.editor.view);
      return;
    }

    defaultView.setTimeout(() => {
      if (this.editor.view) {
        this.update(this.editor.view);
      }
    }, 0);
  };

  private blurHandler = ({ event }: { event: FocusEvent }) => {
    if (this.preventHide) {
      this.preventHide = false;
      return;
    }

    const relatedTarget = event?.relatedTarget as Node | null;
    if (relatedTarget && this.element.parentNode?.contains(relatedTarget)) {
      return;
    }

    if (relatedTarget === this.editor.view?.dom) {
      return;
    }

    this.hide();
  };

  private transactionHandler = ({ transaction }: { transaction: any }) => {
    const meta = transaction?.getMeta?.(this.pluginKeyRef);
    if (meta === "updatePosition") {
      this.updatePosition();
    }
  };

  private resizeHandler = () => {
    const defaultView = this.ownerDocument.defaultView;
    if (!defaultView) {
      this.updatePosition();
      return;
    }

    if (this.resizeDebounceTimer) {
      defaultView.clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = defaultView.setTimeout(() => {
      this.updatePosition();
    }, this.resizeDelay);
  };

  private createRenderProps(rect: PopupRect): BubbleMenuRenderProps {
    return {
      editor: this.editor,
      view: this.view,
      rect,
      ownerDocument: this.ownerDocument,
      popup: this.popup,
      actions: this.actions,
      canRunAction: (action) => canRunActionByView(this.view, action),
      isActionActive: (action) => isActionMarkActiveByView(this.view, action),
      runAction: (action) => {
        const executed = runActionByView(this.view, action);
        if (!executed) {
          return false;
        }
        this.view?.focus?.();
        this.update(this.view);
        return true;
      },
    };
  }

  private resolveReference(): { reference: PopupReference; rect: PopupRect | null } {
    const virtualElement = this.getReferencedVirtualElement?.();
    if (virtualElement) {
      const reference = () => virtualElement.getBoundingClientRect();
      const rect = toPopupRect(reference());
      return { reference, rect };
    }

    const rect = resolveSelectionRect(this.view);
    return { reference: rect, rect };
  }

  private getShouldShow(oldState?: any) {
    const state = this.view?.state;
    if (!state?.selection) {
      return false;
    }

    const { from, to } = getSelectionRange(state.selection);
    const { rect } = this.resolveReference();
    return this.shouldShow({
      editor: this.editor,
      element: this.element,
      view: this.view,
      state,
      oldState,
      from,
      to,
      rect,
    });
  }

  private updateElement(rect: PopupRect) {
    if (!this.defaultElementRuntime) {
      return;
    }
    this.defaultElementRuntime.update(this.createRenderProps(rect));
  }

  private show(reference: PopupReference, rect: PopupRect) {
    this.updateElement(rect);
    this.popup.show(reference, this.element);
    this.isVisible = true;
  }

  private hide() {
    if (!this.isVisible) {
      return;
    }
    this.popup.hide();
    this.isVisible = false;
  }

  updatePosition() {
    if (!this.isVisible) {
      return;
    }

    const { reference, rect } = this.resolveReference();
    if (!reference || !rect) {
      this.hide();
      return;
    }

    this.show(reference, rect);
  }

  private updateHandler = (view: any, selectionChanged: boolean, docChanged: boolean, oldState?: any) => {
    if (!view) {
      return;
    }

    const isSame = !selectionChanged && !docChanged;
    if (isSame) {
      return;
    }

    this.view = view;

    if (!this.getShouldShow(oldState)) {
      this.hide();
      return;
    }

    const { reference, rect } = this.resolveReference();
    if (!reference || !rect) {
      this.hide();
      return;
    }

    this.show(reference, rect);
  };

  private handleDebouncedUpdate = (view: any, oldState?: any) => {
    const selectionChanged = !oldState?.selection?.eq?.(view.state.selection);
    const docChanged = !oldState?.doc?.eq?.(view.state.doc);

    if (!selectionChanged && !docChanged) {
      return;
    }

    const defaultView = this.ownerDocument.defaultView;
    if (!defaultView) {
      this.updateHandler(view, selectionChanged, docChanged, oldState);
      return;
    }

    if (this.updateDebounceTimer) {
      defaultView.clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = defaultView.setTimeout(() => {
      this.updateHandler(view, selectionChanged, docChanged, oldState);
    }, this.updateDelay);
  };

  update(view: any, oldState?: any) {
    if (!view?.state) {
      return;
    }

    const selection = view.state.selection;
    const hasValidSelection =
      Number.isFinite(selection?.from) &&
      Number.isFinite(selection?.to) &&
      selection.from !== selection.to;

    if (this.updateDelay > 0 && hasValidSelection) {
      this.handleDebouncedUpdate(view, oldState);
      return;
    }

    const selectionChanged = !oldState?.selection?.eq?.(view.state.selection);
    const docChanged = !oldState?.doc?.eq?.(view.state.doc);
    this.updateHandler(view, selectionChanged, docChanged, oldState);
  }

  destroy() {
    const defaultView = this.ownerDocument.defaultView;
    if (defaultView && this.updateDebounceTimer) {
      defaultView.clearTimeout(this.updateDebounceTimer);
    }
    if (defaultView && this.resizeDebounceTimer) {
      defaultView.clearTimeout(this.resizeDebounceTimer);
    }

    this.hide();
    this.element.removeEventListener("mousedown", this.mousedownHandler, true);
    this.view?.dom?.removeEventListener?.("dragstart", this.dragstartHandler);
    this.ownerDocument.removeEventListener("pointerdown", this.documentPointerDownHandler, true);
    this.ownerDocument.removeEventListener("keydown", this.documentKeyDownHandler, true);
    this.ownerDocument.removeEventListener("scroll", this.resizeHandler, true);
    this.ownerDocument.defaultView?.removeEventListener("resize", this.resizeHandler);
    this.editor.off("focus", this.focusHandler);
    this.editor.off("blur", this.blurHandler);
    this.editor.off("transaction", this.transactionHandler);
    this.popup.destroy();
  }
}

export const BubbleMenuPlugin = (options: BubbleMenuPluginProps) => {
  const pluginKeyRef = options.pluginKey || DEFAULT_PLUGIN_KEY;
  const pluginKey =
    pluginKeyRef instanceof PluginKey ? pluginKeyRef : new PluginKey(String(pluginKeyRef));

  return new Plugin({
    key: pluginKey,
    view: (view) =>
      new BubbleMenuView({
        ...options,
        view,
        pluginKeyRef,
      }),
  });
};
