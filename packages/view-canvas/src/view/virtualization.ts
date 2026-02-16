/*
 * 文件说明：可见页计算。
 * 主要职责：根据滚动位置返回可见页区间。
 */

export function getVisiblePages(layout, scrollTop, viewportHeight) {
  if (!layout || layout.pages.length === 0) {
    return { startIndex: 0, endIndex: -1 };
  }

  const pageSpan = layout.pageHeight + layout.pageGap;

  const startIndex = Math.max(0, Math.floor(scrollTop / pageSpan) - 1);

  const endIndex = Math.min(
    layout.pages.length - 1,

    Math.ceil((scrollTop + viewportHeight) / pageSpan) + 1
  );

  return { startIndex, endIndex };
}
