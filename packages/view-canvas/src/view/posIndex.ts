/*
 * 文件说明：坐标与位置映射封装。
 * 主要职责：把坐标转换为文本偏移，供点击/拖拽命中使用。
 */

import { getCaretFromPoint, getCaretRect } from "./caret";

export function coordsAtPos(layout, offset, scrollTop, viewportWidth, textLength) {
  return getCaretRect(layout, offset, scrollTop, viewportWidth, textLength);
}

export function posAtCoords(layout, x, y, scrollTop, viewportWidth, textLength) {
  const hit = getCaretFromPoint(
    layout,

    x,

    y,

    scrollTop,

    viewportWidth,

    textLength
  );

  if (!hit || !Number.isFinite(hit.offset)) {
    return null;
  }

  return hit.offset;
}
