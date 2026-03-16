// 释放编辑器绑定的事件、插件与节点资源。
export const destroyView = (view) => {
  const {
    dom,
    detachInputBridge,
    unbindDomEvents,
    destroyNodeViews,
    destroyPluginViews,
    clearDomEventHandlers,
    getRafId,
  } = view._internals;

  detachInputBridge?.();
  destroyNodeViews?.();
  destroyPluginViews?.();
  clearDomEventHandlers?.();
  unbindDomEvents?.();

  const rafId = getRafId?.();
  if (rafId) {
    cancelAnimationFrame(rafId);
  }
  view?._internals?.renderSync?.destroy?.();

  if (view.dom.parentNode) {
    view.dom.parentNode.removeChild(view.dom);
  }
};
