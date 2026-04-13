import { getEditorInternalsSections } from "../internals.js";

export const toInsets = (value: any, fallback = 0) => {
  if (Number.isFinite(value)) {
    const nextValue = Math.max(0, Number(value));
    return { top: nextValue, right: nextValue, bottom: nextValue, left: nextValue };
  }
  if (value && typeof value === "object") {
    const top = Number.isFinite(value.top) ? Math.max(0, Number(value.top)) : fallback;
    const right = Number.isFinite(value.right) ? Math.max(0, Number(value.right)) : fallback;
    const bottom = Number.isFinite(value.bottom) ? Math.max(0, Number(value.bottom)) : fallback;
    const left = Number.isFinite(value.left) ? Math.max(0, Number(value.left)) : fallback;
    return { top, right, bottom, left };
  }
  return { top: fallback, right: fallback, bottom: fallback, left: fallback };
};

export const callBooleanPropHandlers = (view: any, propName: string, ...args: any[]) => {
  const { viewSync } = getEditorInternalsSections(view);
  const propsList = viewSync?.getEditorPropsList?.(view.state) ?? [];
  for (const props of propsList) {
    const handler = props?.[propName];
    if (typeof handler === "function") {
      if (handler(view, ...args)) {
        return true;
      }
      continue;
    }
    if (handler === true) {
      return true;
    }
  }
  return false;
};

const LAYOUT_AFFECTING_SETTING_KEYS = new Set([
  "pageWidth",
  "pageHeight",
  "pageGap",
  "margin",
  "lineHeight",
  "font",
  "codeFont",
  "wrapTolerance",
  "minLineWidth",
  "measureTextWidth",
  "segmentText",
  "blockSpacing",
  "paragraphSpacingBefore",
  "paragraphSpacingAfter",
  "listIndent",
  "listMarkerGap",
  "listMarkerFont",
  "codeBlockPadding",
  "textLocale",
]);

export const isPlainObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const applySettingsPatch = (settings: Record<string, any>, patch: Record<string, any>) => {
  const changedKeys: string[] = [];
  for (const [key, nextValue] of Object.entries(patch || {})) {
    const prevValue = settings[key];
    let resolvedValue = nextValue;
    if (isPlainObject(prevValue) && isPlainObject(nextValue)) {
      resolvedValue = { ...prevValue, ...nextValue };
    }
    if (prevValue === resolvedValue) {
      continue;
    }
    settings[key] = resolvedValue;
    changedKeys.push(key);
  }
  return changedKeys;
};

export const shouldUseLayoutRefreshForSettings = (keys: string[]) =>
  keys.some((key) => LAYOUT_AFFECTING_SETTING_KEYS.has(key));
