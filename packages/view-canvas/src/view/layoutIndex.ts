import { findLineForOffset, offsetAtX, getCaretFromPoint } from "./caret";

// 根据 layout 构建行索引，便于快速定位。
export const buildLayoutIndex = (layout) => {
  if (!layout) {
    return null;
  }

  const items = [];
  let maxOffset = 0;

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      items.push({
        pageIndex: p,
        lineIndex: l,
        line,
        start: line.start,
        end: line.end,
        mid: (line.start + line.end) / 2,
      });
      maxOffset = Math.max(maxOffset, line.end ?? 0);
    }
  }

  return {
    maxOffset,
    lines: items,
  };
};

// 二分查找最接近的行条目。
const binarySearchClosest = (lines, target) => {
  let low = 0;
  let high = lines.length - 1;
  let best = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = lines[mid];
    if (!item) {
      break;
    }
    if (target < item.start) {
      best = item;
      high = mid - 1;
      continue;
    }
    if (target > item.end) {
      low = mid + 1;
      continue;
    }
    return item;
  }

  if (!best && lines.length > 0) {
    best = lines[lines.length - 1];
  }

  return best;
};

// 在索引中获取 offset 对应的行。
export const getLineAtOffset = (layoutIndex, offset) => {
  if (!layoutIndex || !layoutIndex.lines || layoutIndex.lines.length === 0) {
    return null;
  }

  const clamped = Math.max(0, Math.min(offset, layoutIndex.maxOffset));

  return binarySearchClosest(layoutIndex.lines, clamped);
};

// 优先使用索引查找行，必要时回退遍历。
export const findLineForOffsetIndexed = (layout, offset, textLength, layoutIndex = null) => {
  if (!layoutIndex) {
    return findLineForOffset(layout, offset, textLength);
  }

  const hit = getLineAtOffset(layoutIndex, offset);
  if (!hit) {
    return findLineForOffset(layout, offset, textLength);
  }

  return {
    pageIndex: hit.pageIndex,
    lineIndex: hit.lineIndex,
    line: hit.line,
  };
};

// 基于 x 计算行内偏移（索引版）。
export const offsetAtXIndexed = (layout, line, x) => offsetAtX(layout.font, line, x);

// 基于坐标计算文本偏移（索引版）。
export const posAtCoordsIndexed = (
  layout,
  x,
  y,
  scrollTop,
  viewportWidth,
  textLength,
  layoutIndex = null
) => {
  if (!layoutIndex) {
    return null;
  }

  const hit = getCaretFromPoint(layout, x, y, scrollTop, viewportWidth, textLength);
  if (!hit || !Number.isFinite(hit.offset)) {
    return null;
  }

  return hit.offset;
};
