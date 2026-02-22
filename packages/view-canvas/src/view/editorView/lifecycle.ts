// 释放编辑器绑定的事件、插件与节点资源。
export const destroyView = (view) => {
  const {
    dom,
    detachInputBridge,
    onScroll,
    onResize,
    onClickFocus,
    onDoubleClick,
    onRootFocus,
    onDocumentSelectionChange,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    destroyNodeViews,
    destroyPluginViews,
    clearDomEventHandlers,
    getRafId,
  } = view._internals;
  const ownerDocument = dom.root?.ownerDocument || document;
  const ownerWindow = ownerDocument.defaultView || window;

  detachInputBridge?.();
  destroyNodeViews?.();
  destroyPluginViews?.();
  clearDomEventHandlers?.();
  dom.input.removeEventListener("focus", view._internals.renderSync.updateStatus);
  dom.input.removeEventListener("blur", view._internals.renderSync.updateStatus);
  dom.input.removeEventListener("blur", view._internals.resetComposing);
  dom.scrollArea.removeEventListener("scroll", onScroll);
  dom.root.removeEventListener("pointerdown", handlePointerDown);
  dom.root.removeEventListener("pointermove", handlePointerMove);
  dom.root.removeEventListener("pointerup", handlePointerUp);
  dom.root.removeEventListener("pointercancel", handlePointerUp);
  dom.scrollArea.removeEventListener("touchstart", handleTouchStart);
  dom.scrollArea.removeEventListener("touchmove", handleTouchMove);
  dom.scrollArea.removeEventListener("touchend", handleTouchEnd);
  dom.scrollArea.removeEventListener("touchcancel", handleTouchCancel);
  dom.root.removeEventListener("dragstart", handleDragStart);
  dom.root.removeEventListener("dragover", handleDragOver);
  dom.root.removeEventListener("dragleave", handleDragLeave);
  dom.root.removeEventListener("drop", handleDrop);
  dom.root.removeEventListener("dragend", handleDragEnd);
  dom.root.removeEventListener("click", onClickFocus);
  dom.root.removeEventListener("dblclick", onDoubleClick);
  dom.root.removeEventListener("focus", onRootFocus);
  ownerDocument.removeEventListener("selectionchange", onDocumentSelectionChange);
  ownerWindow.removeEventListener("resize", onResize);

  const rafId = getRafId?.();
  if (rafId) {
    cancelAnimationFrame(rafId);
  }

  if (view.dom.parentNode) {
    view.dom.parentNode.removeChild(view.dom);
  }
};
