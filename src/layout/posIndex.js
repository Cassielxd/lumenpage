import { getCaretFromPoint, getCaretRect } from "../core/caret.js";

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
