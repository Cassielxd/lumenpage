import type { CanvasEditorViewProps } from "../types";
import {
  applySettingsPatch,
  isPlainObject,
  shouldUseLayoutRefreshForSettings,
} from "./shared";

export const forceViewRender = (
  view: any,
  options: {
    clearPageCache?: boolean;
    markLayoutForceRedraw?: boolean;
    syncNodeViews?: boolean;
  } = {}
) => {
  const internals = view?._internals;
  if (!internals) {
    return false;
  }
  if (options.markLayoutForceRedraw !== false) {
    const layout = internals?.getLayout?.();
    if (layout && typeof layout === "object") {
      layout.__forceRedraw = true;
    }
  }
  if (options.clearPageCache !== false) {
    internals?.renderer?.pageCache?.clear?.();
  }
  if (options.syncNodeViews === true) {
    internals?.syncNodeViews?.();
  }
  internals?.scheduleRender?.();
  return true;
};

export const forceViewLayout = (
  view: any,
  options: {
    clearLayoutCache?: boolean;
    clearPageCache?: boolean;
    immediate?: boolean;
  } = {}
) => {
  const internals = view?._internals;
  if (!internals) {
    return false;
  }
  if (options.clearLayoutCache !== false) {
    internals?.layoutPipeline?.clearCache?.();
  }
  if (options.clearPageCache !== false) {
    internals?.renderer?.pageCache?.clear?.();
  }
  const layout = internals?.getLayout?.();
  if (layout && typeof layout === "object") {
    layout.__forceRedraw = true;
  }
  if (options.immediate === false) {
    internals?.scheduleLayout?.();
  } else {
    try {
      (globalThis as any).__lumenForceSyncLayoutOnce = true;
    } catch (_error) {
      // Ignore environments where global flags are unavailable.
    }
    internals?.updateLayout?.();
  }
  return true;
};

export const setViewProps = (view: any, props: Partial<CanvasEditorViewProps> = {}) => {
  const prevProps = view?._internals?.getEditorProps?.() ?? {};
  const nextProps = { ...prevProps, ...(props || {}) };
  view?._internals?.setEditorProps?.(nextProps);
  let visualRefreshHandled = false;

  if (Object.prototype.hasOwnProperty.call(props, "state") && props.state) {
    view.updateState(props.state);
  }

  const settingsPatch = props?.canvasViewConfig?.settings;
  if (isPlainObject(settingsPatch) && view?._internals?.settings) {
    const changedKeys = applySettingsPatch(view._internals.settings, settingsPatch);
    if (changedKeys.length > 0) {
      visualRefreshHandled = true;
      if (shouldUseLayoutRefreshForSettings(changedKeys)) {
        forceViewLayout(view);
      } else {
        forceViewRender(view);
      }
    }
  }

  view?._internals?.refreshDomEventHandlers?.(view.state);
  view?._internals?.applyViewAttributes?.(view.state);
  view?._internals?.syncNodeViews?.();
  if (!visualRefreshHandled) {
    view?._internals?.scheduleRender?.();
  }
  view?._internals?.updateA11yStatus?.();
};
