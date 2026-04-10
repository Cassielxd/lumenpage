import type { CanvasEditorViewProps } from "../types";
import { getEditorInternalsSections } from "../internals";
import { setLayoutForceRedraw } from "../../layoutRuntimeMetadata";
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
  const { core, stateAccessors, viewSync } = getEditorInternalsSections(view);
  if (!internals) {
    return false;
  }
  if (options.markLayoutForceRedraw !== false) {
    const layout = stateAccessors?.getLayout?.();
    if (layout && typeof layout === "object") {
      setLayoutForceRedraw(layout, true);
    }
  }
  if (options.clearPageCache !== false) {
    core?.renderer?.pageCache?.clear?.();
  }
  if (options.syncNodeViews === true) {
    viewSync?.syncNodeViews?.();
  }
  viewSync?.scheduleRender?.();
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
  const { core, stateAccessors, viewSync } = getEditorInternalsSections(view);
  if (!internals) {
    return false;
  }
  if (options.clearLayoutCache !== false) {
    core?.layoutPipeline?.clearCache?.();
  }
  if (options.clearPageCache !== false) {
    core?.renderer?.pageCache?.clear?.();
  }
  const layout = stateAccessors?.getLayout?.();
  if (layout && typeof layout === "object") {
    setLayoutForceRedraw(layout, true);
  }
  if (options.immediate === false) {
    viewSync?.scheduleLayout?.();
  } else {
    try {
      (globalThis as any).__lumenForceSyncLayoutOnce = true;
    } catch (_error) {
      // Ignore environments where global flags are unavailable.
    }
    viewSync?.updateLayout?.();
  }
  return true;
};

export const setViewProps = (view: any, props: Partial<CanvasEditorViewProps> = {}) => {
  const { core, stateAccessors, viewSync } = getEditorInternalsSections(view);
  const prevProps = stateAccessors?.getEditorProps?.() ?? {};
  const nextProps = { ...prevProps, ...(props || {}) };
  stateAccessors?.setEditorProps?.(nextProps);
  let visualRefreshHandled = false;

  if (Object.prototype.hasOwnProperty.call(props, "state") && props.state) {
    view.updateState(props.state);
  }

  const settingsPatch = props?.canvasViewConfig?.settings;
  if (isPlainObject(settingsPatch) && core?.settings) {
    const changedKeys = applySettingsPatch(core.settings, settingsPatch);
    if (changedKeys.length > 0) {
      visualRefreshHandled = true;
      if (shouldUseLayoutRefreshForSettings(changedKeys)) {
        forceViewLayout(view);
      } else {
        forceViewRender(view);
      }
    }
  }

  viewSync?.refreshDomEventHandlers?.(view.state);
  viewSync?.applyViewAttributes?.(view.state);
  viewSync?.syncNodeViews?.();
  if (!visualRefreshHandled) {
    viewSync?.scheduleRender?.();
  }
  viewSync?.updateA11yStatus?.();
};
