// 缁熶竴鎶婃暟鍊?瀵硅薄褰㈠紡鐨勮竟璺濋厤缃浆鎴愬洓杈?inset銆?

import { isTableLayoutLine } from "../layoutSemantics";
import type { CanvasEditorViewProps } from "./types";

const toInsets = (value, fallback = 0) => {
  if (Number.isFinite(value)) {
    const v = Math.max(0, Number(value));
    return { top: v, right: v, bottom: v, left: v };
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

const callBooleanPropHandlers = (view, propName, ...args) => {
  const propsList = view?._internals?.getEditorPropsList?.(view.state) ?? [];
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

const isPlainObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const applySettingsPatch = (settings: Record<string, any>, patch: Record<string, any>) => {
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

const shouldUseLayoutRefreshForSettings = (keys: string[]) =>
  keys.some((key) => LAYOUT_AFFECTING_SETTING_KEYS.has(key));

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
    internals?.updateLayout?.();
  }
  return true;
};

// 瑙嗗浘 props 鍔ㄦ€佹洿鏂板叆鍙ｏ細鍒锋柊浜嬩欢銆佸睘鎬с€佹覆鏌撲笌 a11y銆?
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

// 璇诲彇 EditorProps/PluginProps 涓殑鏌愪釜灞炴€э紙涓?someProp 璇箟涓€鑷达級銆?
export const readSomeProp = (view, propName, f) => {
  const propsList = view?._internals?.getEditorPropsList?.(view.state) ?? [];
  for (const props of propsList) {
    const value = props?.[propName];
    if (value == null) {
      continue;
    }
    if (typeof f === "function") {
      const result = f(value);
      // Stop on the first truthy result, matching the editor prop pipeline contract.
      if (result) {
        return result;
      }
    } else {
      return value;
    }
  }
  return undefined;
};

// 缁熶竴娲惧彂 transaction锛堝澶?API锛夈€?
export const dispatchViewTransaction = (view, tr) => {
  if (!tr) {
    return;
  }
  const dispatchTransaction =
    (typeof view?.dispatchTransaction === "function" ? view.dispatchTransaction : null) ||
    view?._internals?.dispatchTransaction;
  if (dispatchTransaction) {
    dispatchTransaction(tr);
  }
};

// 鍒ゆ柇鍏夋爣鏄惁浣嶄簬鏂囨湰鍧楄竟鐣岋紙瀵归綈 endOfTextblock 璇箟锛夈€?
export const isEndOfTextblock = (view, dir = "forward", state = undefined) => {
  const targetState = state || view?.state;
  const selection = targetState?.selection;
  const cursor = selection?.$cursor || selection?.$from;
  if (!cursor) {
    return false;
  }
  const isBackward = dir === "backward" || dir === "left" || dir === "up";
  const isForward = dir === "forward" || dir === "right" || dir === "down";
  if (isBackward) {
    return cursor.parentOffset === 0;
  }
  if (isForward) {
    return cursor.parentOffset === cursor.parent.content.size;
  }
  return false;
};

// 鏂囨。浣嶇疆 -> 瑙嗗浘鍧愭爣锛堝澶?API锛夈€?
export const viewCoordsAtPos = (view, pos, docPosToTextOffset, coordsAtPosImpl) => {
  if (!view?.state?.doc) {
    return null;
  }
  const layout = view?._internals?.getLayout?.() ?? null;
  if (!layout) {
    return null;
  }
  const textLength = view?._internals?.getTextLength?.() ?? 0;
  const layoutIndex = view?._internals?.getLayoutIndex?.() ?? null;
  const offset = docPosToTextOffset(view.state.doc, pos);
  const rect = coordsAtPosImpl(
    layout,
    offset,
    view._internals.dom.scrollArea.scrollTop,
    view._internals.dom.scrollArea.clientWidth,
    textLength,
    { layoutIndex }
  );
  if (!rect) {
    return null;
  }
  return {
    left: rect.x,
    right: rect.x + 1,
    top: rect.y,
    bottom: rect.y + rect.height,
  };
};

// 瑙嗗浘鍧愭爣 -> 鏂囨。浣嶇疆锛堝澶?API锛夈€?
// 褰撲紶鍏?client 鍧愭爣鏃讹紝杩斿洖 { pos, inside } 浠ュ吋瀹?PM 鐢熸€佽皟鐢ㄣ€?
export const viewPosAtCoords = (
  view,
  coords,
  textOffsetToDocPos,
  posAtCoordsImpl,
  NodeSelectionClass
) => {
  if (!coords || !view?.state?.doc) {
    return null;
  }
  const layout = view?._internals?.getLayout?.() ?? null;
  if (!layout) {
    return null;
  }
  let x = null;
  let y = null;
  if (Number.isFinite(coords?.clientX) && Number.isFinite(coords?.clientY)) {
    const rect = view._internals.dom.scrollArea.getBoundingClientRect();
    x = coords.clientX - rect.left;
    y = coords.clientY - rect.top;
  } else {
    x = coords.left ?? coords.x;
    y = coords.top ?? coords.y;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const textLength = view?._internals?.getTextLength?.() ?? 0;
  const layoutIndex = view?._internals?.getLayoutIndex?.() ?? null;
  const offset = posAtCoordsImpl(
    layout,
    x,
    y,
    view._internals.dom.scrollArea.scrollTop,
    view._internals.dom.scrollArea.clientWidth,
    textLength,
    { layoutIndex }
  );
  if (offset == null) {
    return null;
  }
  const pos = textOffsetToDocPos(view.state.doc, offset);
  if (Number.isFinite(coords?.clientX) && Number.isFinite(coords?.clientY)) {
    let inside = -1;
    try {
      const $pos = view.state.doc.resolve(pos);
      const after = $pos.nodeAfter;
      if (after && NodeSelectionClass.isSelectable(after)) {
        inside = pos;
      } else {
        const before = $pos.nodeBefore;
        if (before && NodeSelectionClass.isSelectable(before)) {
          inside = pos - before.nodeSize;
        }
      }
    } catch (_error) {
      inside = -1;
    }
    return { pos, inside };
  }
  return pos;
};

// 婊氬姩鍒扮洰鏍囬€夋嫨锛氫紭鍏堝皧閲?handleScrollToSelection锛屽叾娆℃墽琛岄粯璁ゆ粴鍔ㄧ瓥鐣ャ€?
export const scrollViewIntoView = (view, pos, docPosToTextOffset, coordsAtPosImpl) => {
  const renderSync = view?._internals?.renderSync ?? null;
  if (typeof renderSync?.isLayoutPending === "function" && renderSync.isLayoutPending()) {
    if (typeof renderSync?.requestScrollIntoView === "function") {
      const targetPos = Number.isFinite(pos) ? Number(pos) : view?.state?.selection?.head ?? null;
      renderSync.requestScrollIntoView(targetPos);
      return;
    }
  }
  if (callBooleanPropHandlers(view, "handleScrollToSelection")) {
    return;
  }
  if (!view?.state?.doc) {
    return;
  }
  const layout = view?._internals?.getLayout?.() ?? null;
  if (!layout) {
    return;
  }
  const scrollArea = view._internals.dom.scrollArea;
  const targetPos = Number.isFinite(pos) ? pos : view.state?.selection?.head ?? 0;
  const textLength = view?._internals?.getTextLength?.() ?? 0;
  const layoutIndex = view?._internals?.getLayoutIndex?.() ?? null;
  const offset = docPosToTextOffset(view.state.doc, targetPos);
  const rect = coordsAtPosImpl(
    layout,
    offset,
    scrollArea.scrollTop,
    scrollArea.clientWidth,
    textLength,
    { layoutIndex }
  );
  if (!rect) {
    return;
  }
  const settings = view?._internals?.settings || {};
  const defaultMargin = Number.isFinite(settings.scrollMargin)
    ? settings.scrollMargin
    : Number.isFinite(settings.lineHeight)
      ? settings.lineHeight
      : 0;
  const margin = toInsets(
    view?._internals?.queryEditorProp?.("scrollMargin"),
    Math.max(0, Number(defaultMargin) || 0)
  );
  const threshold = toInsets(view?._internals?.queryEditorProp?.("scrollThreshold"), 0);
  const viewportHeight = scrollArea.clientHeight;
  const currentScrollTop = scrollArea.scrollTop;
  let nextScrollTop = currentScrollTop;
  const visibleTop = threshold.top;
  const visibleBottom = viewportHeight - threshold.bottom;
  if (rect.y >= visibleTop && rect.y + rect.height <= visibleBottom) {
    return;
  }
  if (rect.y < visibleTop + margin.top) {
    nextScrollTop = Math.max(0, currentScrollTop + rect.y - visibleTop - margin.top);
  } else if (rect.y + rect.height > visibleBottom - margin.bottom) {
    nextScrollTop = Math.max(
      0,
      currentScrollTop + rect.y + rect.height - (visibleBottom - margin.bottom)
    );
  }
  if (Number.isFinite(nextScrollTop) && nextScrollTop !== currentScrollTop) {
    scrollArea.scrollTop = nextScrollTop;
  }
};

// 鍒ゆ柇缂栬緫鍣ㄦ槸鍚﹀浜庣劍鐐瑰唴锛堟牴鑺傜偣/杈撳叆灞傦級銆?
export const viewHasFocus = (view) => {
  const root = view?._internals?.dom?.root;
  const input = view?._internals?.dom?.input;
  const ownerDocument = root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const active = ownerDocument?.activeElement ?? null;
  if (!active) {
    return false;
  }
  return active === input || active === root || !!root?.contains?.(active);
};

// 鑱氱劍杈撳叆灞傘€?
export const focusView = (view) => {
  view?._internals?.dom?.input?.focus?.();
};

// 鏄惁鍙紪杈戯紙readOnly 鐨勫弽鍚戣涔夛級銆?
export const isViewEditable = (view) => view?._internals?.dom?.input?.readOnly !== true;

export const getViewPaginationInfo = (view) => {
  const layout = view?._internals?.getLayout?.() ?? null;
  const settings = view?._internals?.settings ?? null;
  const scrollArea = view?._internals?.dom?.scrollArea ?? null;
  if (!layout || !settings || !scrollArea) {
    return null;
  }

  const pageGap = Number.isFinite(layout.pageGap) ? layout.pageGap : settings.pageGap ?? 0;
  const pageSpan = layout.pageHeight + pageGap;
  const scrollTop = Number.isFinite(scrollArea.scrollTop) ? scrollArea.scrollTop : 0;
  const viewportHeight = Number.isFinite(scrollArea.clientHeight) ? scrollArea.clientHeight : 0;

  let visibleStartIndex = 0;
  let visibleEndIndex = Math.max(0, (layout.pages?.length ?? 1) - 1);
  if (pageSpan > 0) {
    visibleStartIndex = Math.max(0, Math.floor(scrollTop / pageSpan));
    visibleEndIndex = Math.min(
      Math.max(0, (layout.pages?.length ?? 1) - 1),
      Math.floor((scrollTop + Math.max(0, viewportHeight - 1)) / pageSpan)
    );
  }

  let tableLineCount = 0;
  let tableSliceCount = 0;
  const pages = (layout.pages || []).map((page, pageIndex) => {
    const lineCount = page?.lines?.length ?? 0;
    let tableLines = 0;
    let tableSlices = 0;
    for (const line of page?.lines || []) {
      if (!isTableLayoutLine(line)) {
        continue;
      }
      tableLines += 1;
      const attrs = line?.blockAttrs || {};
      if (
        attrs.tableSliceFromPrev ||
        attrs.tableSliceHasNext ||
        line?.tableMeta?.continuedFromPrev ||
        line?.tableMeta?.continuesAfter ||
        line?.tableMeta?.rowSplit
      ) {
        tableSlices += 1;
      }
    }
    tableLineCount += tableLines;
    tableSliceCount += tableSlices;
    return {
      index: pageIndex,
      fromY: pageIndex * pageSpan,
      toY: pageIndex * pageSpan + layout.pageHeight,
      lineCount,
      rootIndexMin: Number.isFinite(page?.rootIndexMin) ? page.rootIndexMin : null,
      rootIndexMax: Number.isFinite(page?.rootIndexMax) ? page.rootIndexMax : null,
      tableLines,
      tableSlices,
    };
  });

  return {
    pageCount: layout.pages?.length ?? 0,
    totalHeight: layout.totalHeight ?? 0,
    pageWidth: layout.pageWidth ?? settings.pageWidth ?? 0,
    pageHeight: layout.pageHeight ?? settings.pageHeight ?? 0,
    pageGap,
    margin: layout.margin ?? settings.margin ?? null,
    lineHeight: settings.lineHeight ?? null,
    blockSpacing: settings.blockSpacing ?? null,
    scrollTop,
    viewportHeight,
    visibleRange: {
      startIndex: visibleStartIndex,
      endIndex: visibleEndIndex,
    },
    stats: {
      tableLineCount,
      tableSliceCount,
    },
    pages,
  };
};

