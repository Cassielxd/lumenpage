/*
 * 文件说明：选区渲染计算。
 * 主要职责：根据选择范围计算矩形集合。
 */

import { measureTextWidth } from "../core/measure.js";

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const offsetToX = (line, offset, layout) => {
  if (!line.runs || line.runs.length === 0) {
    return measureTextWidth(
      layout.font,
      line.text.slice(0, Math.max(0, offset - line.start))
    );
  }

  let x = 0;
  for (const run of line.runs) {
    const runFont = run.font || layout.font;
    const runStart = run.start;
    const runEnd = run.end;
    const runWidth =
      typeof run.width === "number"
        ? run.width
        : measureTextWidth(runFont, run.text);

    if (offset <= runStart) {
      return x;
    }

    if (offset >= runEnd) {
      x += runWidth;
      continue;
    }

    const part = run.text.slice(0, offset - runStart);
    x += measureTextWidth(runFont, part);
    return x;
  }

  return x;
};

export function selectionToRects(
  layout,
  fromOffset,
  toOffset,
  scrollTop,
  viewportWidth,
  textLength
) {
  if (!layout || fromOffset === toOffset) {
    return [];
  }

  const minOffset = Math.max(0, Math.min(fromOffset, toOffset));
  const maxOffset = Math.max(
    minOffset,
    Math.min(Math.max(fromOffset, toOffset), textLength)
  );
  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageSpan = layout.pageHeight + layout.pageGap;
  const rects = [];

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    const pageTop = p * pageSpan - scrollTop;

    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      const lineStart = line.start;
      const lineEnd = line.end;

      if (maxOffset <= lineStart || minOffset >= lineEnd) {
        continue;
      }

      const start = Math.max(minOffset, lineStart);
      const end = Math.min(maxOffset, lineEnd);
      if (end <= start) {
        continue;
      }

      const xStart = offsetToX(line, start, layout);
      const xEnd = offsetToX(line, end, layout);
      const width = xEnd - xStart;

      if (width <= 0) {
        continue;
      }

      rects.push({
        x: pageX + line.x + xStart,
        y: pageTop + line.y,
        width,
        height: getLineHeight(line, layout),
      });
    }
  }

  return rects;
}
