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
    layoutWorker: layoutWorkerClient,
    getRafId,
  } = view._internals;
  const ownerDocument = dom.root?.ownerDocument || document;
  const ownerWindow = ownerDocument.defaultView || window;

  detachInputBridge?.();
  destroyNodeViews?.();
  destroyPluginViews?.();
  clearDomEventHandlers?.();
  layoutWorkerClient?.destroy?.();
  dom.input.removeEventListener("focus", view._internals.renderSync.updateStatus);
  dom.input.removeEventListener("blur", view._internals.renderSync.updateStatus);
  dom.input.removeEventListener("blur", view._internals.resetComposing);
  dom.scrollArea.removeEventListener("scroll", onScroll);
  dom.scrollArea.removeEventListener("pointerdown", handlePointerDown);
  dom.scrollArea.removeEventListener("pointermove", handlePointerMove);
  dom.scrollArea.removeEventListener("pointerup", handlePointerUp);
  dom.scrollArea.removeEventListener("pointercancel", handlePointerUp);
  dom.scrollArea.removeEventListener("touchstart", handleTouchStart);
  dom.scrollArea.removeEventListener("touchmove", handleTouchMove);
  dom.scrollArea.removeEventListener("touchend", handleTouchEnd);
  dom.scrollArea.removeEventListener("touchcancel", handleTouchCancel);
  dom.scrollArea.removeEventListener("dragstart", handleDragStart);
  dom.scrollArea.removeEventListener("dragover", handleDragOver);
  dom.scrollArea.removeEventListener("dragleave", handleDragLeave);
  dom.scrollArea.removeEventListener("drop", handleDrop);
  dom.scrollArea.removeEventListener("dragend", handleDragEnd);
  dom.scrollArea.removeEventListener("click", onClickFocus);
  dom.scrollArea.removeEventListener("dblclick", onDoubleClick);
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
