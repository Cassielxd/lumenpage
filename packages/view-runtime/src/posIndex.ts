/*
 * 文件说明：坐标与位置映射封装。
 * 主要职责：把坐标转换为文本偏移，供点击/拖拽命中使用。
 */

import { getCaretFromPoint, getCaretRect } from "./caret";
import { findLineForOffsetIndexed, getCaretRectIndexed, posAtCoordsIndexed } from "./layoutIndex";

type PosAtCoordsOptions = {
  layoutIndex?: any;
};

export function coordsAtPos(layout, offset, scrollTop, viewportWidth, textLength, options = null) {
  const indexedRect = options?.layoutIndex
    ? getCaretRectIndexed(
        layout,
        offset,
        scrollTop,
        viewportWidth,
        textLength,
        options.layoutIndex,
        options
      )
    : null;
  if (indexedRect) {
    return indexedRect;
  }
  const lineInfo = options?.layoutIndex
    ? findLineForOffsetIndexed(layout, offset, textLength, options.layoutIndex, options)
    : null;
  return getCaretRect(layout, offset, scrollTop, viewportWidth, textLength, {
    ...options,
    lineInfo,
  });
}

export function posAtCoords(
  layout,
  x,
  y,
  scrollTop,
  viewportWidth,
  textLength,
  options: PosAtCoordsOptions | null = null
) {
  const indexedOffset = options?.layoutIndex
    ? posAtCoordsIndexed(layout, x, y, scrollTop, viewportWidth, textLength, options.layoutIndex)
    : null;
  if (Number.isFinite(indexedOffset)) {
    return indexedOffset;
  }

  const hit = getCaretFromPoint(
    layout,
    x,
    y,
    scrollTop,
    viewportWidth,
    textLength,
    options
  );

  if (!hit || !Number.isFinite(hit.offset)) {
    if (!layout || !layout.pages || layout.pages.length === 0) {
      return null;
    }
    const totalHeight = Number.isFinite(layout.totalHeight) ? layout.totalHeight : 0;
    const absoluteY = y + scrollTop;
    if (absoluteY <= 0) {
      return 0;
    }
    if (totalHeight > 0 && absoluteY >= totalHeight) {
      return textLength;
    }
    const clampedY =
      totalHeight > 0 ? Math.max(0, Math.min(y, totalHeight - scrollTop - 1)) : y;
    const fallbackHit = getCaretFromPoint(
      layout,
      x,
      clampedY,
      scrollTop,
      viewportWidth,
      textLength,
      options
    );
    if (fallbackHit && Number.isFinite(fallbackHit.offset)) {
      return fallbackHit.offset;
    }
    return textLength;
  }

  return hit.offset;
}
