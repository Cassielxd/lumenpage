import { getEditorInternalsSections } from "./internals.js";

export const destroyView = (view) => {
  const { core, stateAccessors, viewSync, domEvents } = getEditorInternalsSections(view);

  domEvents?.detachInputBridge?.();
  viewSync?.destroyNodeViews?.();
  viewSync?.destroyPluginViews?.();
  viewSync?.clearDomEventHandlers?.();
  domEvents?.unbindDomEvents?.();

  const rafId = stateAccessors?.getRafId?.();
  if (rafId) {
    cancelAnimationFrame(rafId);
  }
  core?.renderSync?.destroy?.();

  if (view?.dom?.parentNode) {
    view.dom.parentNode.removeChild(view.dom);
  }
};
