// 点击链路统一封装：先走插件 handleXxxOn，再走 handleXxx，再回退 NodeView。
const dispatchNodeEventChain = (state, dispatchEditorProp, propName, pos, event) => {
  if (!Number.isFinite(pos) || !state?.doc) {
    return false;
  }
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const node = $pos.node(depth);
    const nodePos = depth > 0 ? $pos.before(depth) : 0;
    const direct = depth === $pos.depth;
    if (dispatchEditorProp(propName, pos, node, nodePos, event, direct)) {
      return true;
    }
  }
  return false;
};

// 视图层事件处理：只依赖外部注入，避免与 editorView 主体强耦合。
export const createViewEventHandlers = ({
  getState,
  hasFocus,
  getEventCoords,
  getDocPosFromCoords,
  dispatchEditorProp,
  handleNodeViewClick,
  consumeSkipNextClickSelection,
  focusInput,
  debugLog,
  updateStatus,
  updateCaret,
  scheduleRender,
}) => {
  const onClickFocus = (event) => {
    const coords = getEventCoords(event);
    const pos = getDocPosFromCoords(coords);
    debugLog("click", { pos, coords });
    if (consumeSkipNextClickSelection()) {
      focusInput();
      return;
    }
    const state = getState();
    if (event.detail >= 3 && Number.isFinite(pos)) {
      if (dispatchNodeEventChain(state, dispatchEditorProp, "handleTripleClickOn", pos, event)) {
        event.preventDefault();
        return;
      }
      if (dispatchEditorProp("handleTripleClick", pos, event)) {
        event.preventDefault();
        return;
      }
    }
    if (dispatchNodeEventChain(state, dispatchEditorProp, "handleClickOn", pos, event)) {
      event.preventDefault();
      return;
    }
    if (dispatchEditorProp("handleClick", pos, event)) {
      event.preventDefault();
      return;
    }
    if (handleNodeViewClick(event, "handleClick")) {
      event.preventDefault();
      focusInput();
      return;
    }
    focusInput();
  };

  const onDoubleClick = (event) => {
    const coords = getEventCoords(event);
    const pos = getDocPosFromCoords(coords);
    const state = getState();
    if (
      dispatchNodeEventChain(state, dispatchEditorProp, "handleDoubleClickOn", pos, event)
    ) {
      event.preventDefault();
      return;
    }
    if (dispatchEditorProp("handleDoubleClick", pos, event)) {
      event.preventDefault();
      return;
    }
    if (handleNodeViewClick(event, "handleDoubleClick")) {
      event.preventDefault();
    }
  };

  const onRootFocus = () => {
    focusInput();
  };

  const onDocumentSelectionChange = () => {
    if (!hasFocus()) {
      return;
    }
    updateStatus();
    updateCaret(false);
    scheduleRender();
  };

  const onScroll = () => {
    updateCaret(false);
    scheduleRender();
  };

  const onResize = () => {
    updateCaret(false);
    scheduleRender();
  };

  return {
    onClickFocus,
    onDoubleClick,
    onRootFocus,
    onDocumentSelectionChange,
    onScroll,
    onResize,
  };
};

// 统一挂载 DOM 事件，构造函数中只保留装配代码。
export const bindViewDomEvents = ({
  dom,
  updateStatus,
  resetComposing,
  handlers,
  pointerHandlers,
  touchHandlers,
  dragHandlers,
}) => {
  const { onScroll, onClickFocus, onDoubleClick, onRootFocus, onDocumentSelectionChange, onResize } =
    handlers;
  const { handlePointerDown, handlePointerMove, handlePointerUp } = pointerHandlers;
  const { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } = touchHandlers;
  const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } = dragHandlers;
  const ownerDocument = dom.root?.ownerDocument || document;
  const ownerWindow = ownerDocument.defaultView || window;

  dom.input.addEventListener("focus", updateStatus);
  dom.input.addEventListener("blur", updateStatus);
  dom.input.addEventListener("blur", resetComposing);
  dom.scrollArea.addEventListener("scroll", onScroll);
  dom.root.addEventListener("pointerdown", handlePointerDown);
  dom.root.addEventListener("pointermove", handlePointerMove);
  dom.root.addEventListener("pointerup", handlePointerUp);
  dom.root.addEventListener("pointercancel", handlePointerUp);
  dom.scrollArea.addEventListener("touchstart", handleTouchStart, { passive: false });
  dom.scrollArea.addEventListener("touchmove", handleTouchMove, { passive: false });
  dom.scrollArea.addEventListener("touchend", handleTouchEnd);
  dom.scrollArea.addEventListener("touchcancel", handleTouchCancel);
  dom.root.addEventListener("dragstart", handleDragStart);
  dom.root.addEventListener("dragover", handleDragOver);
  dom.root.addEventListener("dragleave", handleDragLeave);
  dom.root.addEventListener("drop", handleDrop);
  dom.root.addEventListener("dragend", handleDragEnd);
  dom.root.addEventListener("click", onClickFocus);
  dom.root.addEventListener("dblclick", onDoubleClick);
  dom.root.addEventListener("focus", onRootFocus);
  ownerDocument.addEventListener("selectionchange", onDocumentSelectionChange);
  ownerWindow.addEventListener("resize", onResize);
};
