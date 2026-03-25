import type { Editor } from "lumenpage-core";
import { NodeSelection, Plugin, PluginKey } from "lumenpage-state";
import {
  createPopupController,
  createPopupRenderRuntime,
  toPopupRect,
  toViewportPopupRect,
  type PopupController,
  type PopupControllerOptions,
  type PopupRenderLifecycle,
  type PopupRenderRuntime,
  type PopupRect,
  type PopupReference,
} from "lumenpage-extension-popup";

export type BubbleMenuAction = {
  id: string;
  label: string;
  command: string;
  args?: unknown[];
  icon?: string;
  markName?: string;
};

export type BubbleMenuRenderProps = {
  editor: Editor;
  view: any;
  state: any;
  element: HTMLElement;
  from: number;
  to: number;
  rect: PopupRect;
  ownerDocument: Document;
  popup: PopupController;
  actions: BubbleMenuAction[];
  runAction: (action: BubbleMenuAction) => boolean;
  canRunAction: (action: BubbleMenuAction) => boolean;
  isActionActive: (action: BubbleMenuAction) => boolean;
};

export type BubbleMenuRenderLifecycle = PopupRenderLifecycle<BubbleMenuRenderProps>;

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
  render?: (() => BubbleMenuRenderLifecycle) | null;
  updateDelay?: number;
  resizeDelay?: number;
  appendTo?: HTMLElement | (() => HTMLElement | null | undefined);
  getReferencedVirtualElement?: (() => BubbleMenuVirtualElement | null) | undefined;
  shouldShow?: ((props: BubbleMenuShouldShowProps) => boolean) | null;
  options?: Omit<PopupControllerOptions, "appendTo">;
  actions?: BubbleMenuAction[];
  className?: string;
};

export type BubbleMenuUpdateOptions = Partial<
  Omit<BubbleMenuPluginProps, "editor" | "pluginKey" | "element" | "render">
>;

type BubbleMenuViewProps = BubbleMenuPluginProps & {
  view: any;
  pluginKeyRef: string | PluginKey;
};

const DEFAULT_PLUGIN_KEY = "bubbleMenu";

const DEFAULT_POPUP_OPTIONS: Omit<PopupControllerOptions, "appendTo"> = {
  placement: "top",
  offset: [0, 8],
  maxWidth: 360,
  interactive: true,
};

const resolvePluginKeyRef = (pluginKey?: string | PluginKey) => pluginKey || DEFAULT_PLUGIN_KEY;

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
  const source = Array.isArray(actions) ? actions : [];
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
      icon: String(action?.icon || "").trim() || undefined,
      markName: String(action?.markName || "").trim() || undefined,
    });
  }

  return normalized;
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
  actions: BubbleMenuAction[];
  className?: string;

  private updateDebounceTimer: number | undefined;
  private resizeDebounceTimer: number | undefined;
  private preventHide = false;
  private isVisible = false;
  private readonly ownerDocument: Document;
  private readonly ownsElement: boolean;
  private readonly renderRuntime: PopupRenderRuntime<BubbleMenuRenderProps>;

  constructor({
    editor,
    view,
    element,
    render,
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
    this.className = className;
    this.actions = normalizeActions(actions);
    this.ownsElement = !element;
    this.element = element || this.ownerDocument.createElement("div");
    if (this.ownsElement) {
      this.element.className = this.className || "";
    }
    this.element.tabIndex = 0;

    this.shouldShow = shouldShow || defaultShouldShow;
    this.popup = createPopupController(this.ownerDocument, {
      ...DEFAULT_POPUP_OPTIONS,
      ...(options || {}),
      appendTo,
    });

    this.renderRuntime = createPopupRenderRuntime(render?.() || {}, () => {
      this.popup.hide();
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
    if (this.renderRuntime.isEventInside(event) || this.element.contains(event.target as Node | null)) {
      return;
    }
    this.hide();
  };

  private documentKeyDownHandler = (event: KeyboardEvent) => {
    if (this.renderRuntime.handleKeyDown(event)) {
      return;
    }
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
      return;
    }

    if (meta && typeof meta === "object" && meta.type === "updateOptions") {
      this.updateOptions(meta.options || {});
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
    const state = this.view?.state;
    const selection = state?.selection;
    const { from, to } = getSelectionRange(selection);

    return {
      editor: this.editor,
      view: this.view,
      state,
      element: this.element,
      from,
      to,
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

  private show(reference: PopupReference, rect: PopupRect) {
    this.renderRuntime.update(this.createRenderProps(rect));
    this.popup.show(reference, this.element);
    this.isVisible = true;
  }

  private hide() {
    if (!this.isVisible) {
      return;
    }
    this.renderRuntime.clear();
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

  updateOptions(newOptions: BubbleMenuUpdateOptions) {
    if (!newOptions) {
      return;
    }

    if (newOptions.updateDelay !== undefined) {
      this.updateDelay = Math.max(0, toFiniteNumber(newOptions.updateDelay, this.updateDelay));
    }
    if (newOptions.resizeDelay !== undefined) {
      this.resizeDelay = Math.max(0, toFiniteNumber(newOptions.resizeDelay, this.resizeDelay));
    }
    if (newOptions.getReferencedVirtualElement !== undefined) {
      this.getReferencedVirtualElement = newOptions.getReferencedVirtualElement;
    }
    if (newOptions.shouldShow !== undefined) {
      this.shouldShow = newOptions.shouldShow || defaultShouldShow;
    }
    if (newOptions.className !== undefined) {
      this.className = newOptions.className;
      if (this.ownsElement) {
        this.element.className = this.className || "";
      }
    }
    if (newOptions.actions !== undefined) {
      this.actions = normalizeActions(newOptions.actions);
    }

    const popupOptions: Partial<PopupControllerOptions> = {};
    if (newOptions.appendTo !== undefined) {
      popupOptions.appendTo = newOptions.appendTo;
    }
    if (newOptions.options) {
      popupOptions.placement = newOptions.options.placement;
      popupOptions.maxWidth = newOptions.options.maxWidth;
      popupOptions.interactive = newOptions.options.interactive;
      popupOptions.offset = newOptions.options.offset;
    }
    this.popup.updateOptions(popupOptions);

    if (this.isVisible) {
      const { reference, rect } = this.resolveReference();
      if (!reference || !rect) {
        this.hide();
        return;
      }
      this.show(reference, rect);
    }
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
    this.renderRuntime.destroy();
    this.popup.destroy();
  }
}

export const BubbleMenuPlugin = (options: BubbleMenuPluginProps) => {
  const pluginKeyRef = resolvePluginKeyRef(options.pluginKey);
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

export const updateBubbleMenuPosition = (view: any, pluginKey?: string | PluginKey) => {
  const pluginKeyRef = resolvePluginKeyRef(pluginKey);
  const transaction = view?.state?.tr?.setMeta?.(pluginKeyRef, "updatePosition");
  if (!transaction) {
    return false;
  }
  view.dispatch(transaction);
  return true;
};

export const updateBubbleMenuOptions = (
  view: any,
  options: BubbleMenuUpdateOptions,
  pluginKey?: string | PluginKey
) => {
  const pluginKeyRef = resolvePluginKeyRef(pluginKey);
  const transaction = view?.state?.tr?.setMeta?.(pluginKeyRef, {
    type: "updateOptions",
    options,
  });
  if (!transaction) {
    return false;
  }
  view.dispatch(transaction);
  return true;
};
