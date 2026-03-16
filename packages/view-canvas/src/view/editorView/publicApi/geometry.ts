import { callBooleanPropHandlers, toInsets } from "./shared";

export const viewCoordsAtPos = (
  view: any,
  pos: any,
  docPosToTextOffset: any,
  coordsAtPosImpl: any
) => {
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

export const viewPosAtCoords = (
  view: any,
  coords: any,
  textOffsetToDocPos: any,
  posAtCoordsImpl: any,
  NodeSelectionClass: any
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

export const scrollViewIntoView = (
  view: any,
  pos: any,
  docPosToTextOffset: any,
  coordsAtPosImpl: any
) => {
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
