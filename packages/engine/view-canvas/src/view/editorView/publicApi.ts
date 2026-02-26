// 统一把数值/对象形式的边距配置转成四边 inset。

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

// 视图 props 动态更新入口：刷新事件、属性、渲染与 a11y。
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

// 读取 EditorProps/PluginProps 中的某个属性（与 someProp 语义一致）。
export const readSomeProp = (view, propName, f) => {
  const propsList = view?._internals?.getEditorPropsList?.(view.state) ?? [];
  for (const props of propsList) {
    const value = props?.[propName];
    if (value == null) {
      continue;
    }
    if (typeof f === "function") {
      const result = f(value);
      // 与 ProseMirror someProp 对齐：仅当回调返回 truthy 时中断。
      if (result) {
        return result;
      }
    } else {
      return value;
    }
  }
  return undefined;
};

// 统一派发 transaction（对外 API）。
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

// 判断光标是否位于文本块边界（对齐 endOfTextblock 语义）。
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

// 文档位置 -> 视图坐标（对外 API）。
export const viewCoordsAtPos = (view, pos, docPosToTextOffset, coordsAtPosImpl) => {
  if (!view?.state?.doc) {
    return null;
  }
  const layout = view?._internals?.getLayout?.() ?? null;
  if (!layout) {
    return null;
  }
  const textLength = view?._internals?.getText?.()?.length ?? 0;
  const offset = docPosToTextOffset(view.state.doc, pos);
  const rect = coordsAtPosImpl(
    layout,
    offset,
    view._internals.dom.scrollArea.scrollTop,
    view._internals.dom.scrollArea.clientWidth,
    textLength
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

// 视图坐标 -> 文档位置（对外 API）。
// 当传入 client 坐标时，返回 { pos, inside } 以兼容 PM 生态调用。
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
  const textLength = view?._internals?.getText?.()?.length ?? 0;
  const offset = posAtCoordsImpl(
    layout,
    x,
    y,
    view._internals.dom.scrollArea.scrollTop,
    view._internals.dom.scrollArea.clientWidth,
    textLength
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

// 滚动到目标选择：优先尊重 handleScrollToSelection，其次执行默认滚动策略。
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
  const textLength = view?._internals?.getText?.()?.length ?? 0;
  const offset = docPosToTextOffset(view.state.doc, targetPos);
  const rect = coordsAtPosImpl(
    layout,
    offset,
    scrollArea.scrollTop,
    scrollArea.clientWidth,
    textLength
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

// 判断编辑器是否处于焦点内（根节点/输入层）。
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

// 聚焦输入层。
export const focusView = (view) => {
  view?._internals?.dom?.input?.focus?.();
};

// 是否可编辑（readOnly 的反向语义）。
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
      if (line?.blockType !== "table") {
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
