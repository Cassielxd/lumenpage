import { findLineForOffset, offsetAtX } from "../caret";
import { measureTextWidth } from "../measure";

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const isImageLine = (line) => line?.imageMeta || line?.blockType === "image";

const offsetToX = (line, offset, layout) => {
  if (!line.runs || line.runs.length === 0) {
    return measureTextWidth(layout.font, line.text.slice(0, Math.max(0, offset - line.start)));
  }

  let x = 0;

  for (const run of line.runs) {
    const runFont = run.font || layout.font;

    const runStart = run.start;

    const runEnd = run.end;

    const runWidth =
      typeof run.width === "number" ? run.width : measureTextWidth(runFont, run.text);

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

const getLineMetrics = (layout) => {
  const items = [];
  let maxOffset = 0;
  let totalLines = 0;

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
      totalLines += 1;
      maxOffset = Math.max(maxOffset, line.end ?? 0);
    }
  }

  return { items, totalLines, maxOffset };
};

export const buildLayoutIndex = (layout) => {
  if (!layout) {
    return null;
  }

  const metrics = getLineMetrics(layout);

  return {
    maxOffset: metrics.maxOffset,
    totalLines: metrics.totalLines,
    lines: metrics.items,
  };
};

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

export const getLineAtOffset = (layoutIndex, offset) => {
  if (!layoutIndex || !layoutIndex.lines || layoutIndex.lines.length === 0) {
    return null;
  }

  const clamped = Math.max(0, Math.min(offset, layoutIndex.maxOffset));

  return binarySearchClosest(layoutIndex.lines, clamped);
};

export function selectionToRects(
  layout,

  fromOffset,

  toOffset,

  scrollTop,

  viewportWidth,

  textLength,

  layoutIndex = null
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

  if (layoutIndex && layoutIndex.lines?.length) {
    for (const item of layoutIndex.lines) {
      const line = item.line;

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

      const isImage = isImageLine(line);

      const xStart = isImage ? 0 : offsetToX(line, start, layout);

      const xEnd = isImage
        ? Math.max(xStart, line.width || 0)
        : offsetToX(line, end, layout);

      const width = xEnd - xStart;

      if (width <= 0) {
        continue;
      }

      rects.push({
        x: pageX + line.x + xStart,

        y: item.pageIndex * pageSpan - scrollTop + line.y,

        width,

        height: getLineHeight(line, layout),
      });
    }

    return rects;
  }

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

      const isImage = isImageLine(line);

      const xStart = isImage ? 0 : offsetToX(line, start, layout);

      const xEnd = isImage
        ? Math.max(xStart, line.width || 0)
        : offsetToX(line, end, layout);

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

export function activeBlockToRects(
  layout,

  offset,

  scrollTop,

  viewportWidth,

  textLength,

  options = {},

  layoutIndex = null
) {
  if (!layout || !Number.isFinite(offset)) {
    return [];
  }

  const info = layoutIndex ? getLineAtOffset(layoutIndex, offset) : null;
  const resolved = info
    ? { line: info.line, pageIndex: info.pageIndex, lineIndex: info.lineIndex }
    : findLineForOffset(layout, offset, textLength);

  if (!resolved?.line) {
    return [];
  }

  const targetLine = resolved.line;
  const blockType = targetLine.blockType;
  const blockStart = targetLine.blockStart;
  const blockTypes = Array.isArray(options.blockTypes)
    ? options.blockTypes
    : ["paragraph", "heading", "image"];

  if (!blockType || !blockTypes.includes(blockType)) {
    return [];
  }

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageSpan = layout.pageHeight + layout.pageGap;
  const rects = [];

  const lineItems = layoutIndex?.lines || null;

  if (lineItems) {
    for (const item of lineItems) {
      const line = item.line;

      const matchesBlock =
        blockStart != null
          ? line.blockStart === blockStart && line.blockType === blockType
          : line === targetLine;

      if (!matchesBlock) {
        continue;
      }

      const width = Math.max(0, line.width || 0);
      const minWidth = blockType === "paragraph" || blockType === "heading" ? 1 : 0;
      const resolvedWidth = Math.max(width, minWidth);

      if (resolvedWidth <= 0) {
        continue;
      }

      rects.push({
        x: pageX + (line.x || 0),

        y: item.pageIndex * pageSpan - scrollTop + line.y,

        width: resolvedWidth,

        height: getLineHeight(line, layout),
      });
    }

    return rects;
  }

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    const pageTop = p * pageSpan - scrollTop;

    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];

      const matchesBlock =
        blockStart != null
          ? line.blockStart === blockStart && line.blockType === blockType
          : line === targetLine;

      if (!matchesBlock) {
        continue;
      }

      const width = Math.max(0, line.width || 0);
      const minWidth = blockType === "paragraph" || blockType === "heading" ? 1 : 0;
      const resolvedWidth = Math.max(width, minWidth);

      if (resolvedWidth <= 0) {
        continue;
      }

      rects.push({
        x: pageX + (line.x || 0),

        y: pageTop + line.y,

        width: resolvedWidth,

        height: getLineHeight(line, layout),
      });
    }
  }

  return rects;
}

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

export const offsetAtXIndexed = (layout, line, x) => offsetAtX(layout.font, line, x);
