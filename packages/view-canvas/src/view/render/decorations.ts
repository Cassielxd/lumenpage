import { getFontSize, measureTextWidth } from "../measure";
import { selectionToRects } from "./selection";
import { normalizeDecorations, type CanvasDecoration, type DecorationSet } from "../decorations";

export type DecorationRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  decoration: CanvasDecoration;
};

export type DecorationTextSegment = {
  text: string;
  x: number;
  y: number;
  font: string;
  color: string;
};

export type DecorationWidget = {
  x: number;
  y: number;
  height?: number;
  decoration: CanvasDecoration;
};

export type DecorationDrawData = {
  inlineRects: DecorationRect[];
  nodeRects: DecorationRect[];
  textSegments: DecorationTextSegment[];
  widgets: DecorationWidget[];
};

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const getBaselineOffset = (lineHeight, fontSize) => Math.max(0, (lineHeight - fontSize) / 2);

const collectLineItems = (layout, layoutIndex) => {
  if (layoutIndex?.lines?.length) {
    return layoutIndex.lines;
  }

  const items = [];
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
      });
    }
  }
  return items;
};

const getRunWidth = (run, fallbackFont) => {
  if (typeof run.width === "number") {
    return run.width;
  }
  const font = run.font || fallbackFont;
  return measureTextWidth(font, run.text || "");
};

const collectTextSegments = ({
  line,
  pageX,
  pageTop,
  rangeStart,
  rangeEnd,
  layout,
  color,
}) => {
  const segments = [];
  const lineHeight = getLineHeight(line, layout);

  if (!line.runs || line.runs.length === 0) {
    const font = layout.font;
    const text = line.text || "";
    const startIndex = Math.max(0, rangeStart - line.start);
    const endIndex = Math.max(startIndex, Math.min(rangeEnd - line.start, text.length));
    if (endIndex <= startIndex) {
      return segments;
    }
    const prefix = text.slice(0, startIndex);
    const segmentText = text.slice(startIndex, endIndex);
    const fontSize = getFontSize(font);
    const baselineOffset = getBaselineOffset(lineHeight, fontSize);
    const x = pageX + (line.x || 0) + measureTextWidth(font, prefix);
    const y = pageTop + line.y + baselineOffset;
    segments.push({ text: segmentText, x, y, font, color });
    return segments;
  }

  let cursorX = 0;

  for (const run of line.runs) {
    const runStart = run.start;
    const runEnd = run.end;
    if (rangeEnd <= runStart) {
      break;
    }
    const runWidth = getRunWidth(run, layout.font);
    if (rangeStart >= runEnd) {
      cursorX += runWidth;
      continue;
    }

    const segmentStart = Math.max(rangeStart, runStart);
    const segmentEnd = Math.min(rangeEnd, runEnd);
    if (segmentEnd <= segmentStart) {
      cursorX += runWidth;
      continue;
    }

    const font = run.font || layout.font;
    const text = run.text || "";
    const startIndex = Math.max(0, segmentStart - runStart);
    const endIndex = Math.max(startIndex, Math.min(segmentEnd - runStart, text.length));
    const prefix = text.slice(0, startIndex);
    const segmentText = text.slice(startIndex, endIndex);
    const fontSize = getFontSize(font);
    const baselineOffset = getBaselineOffset(lineHeight, fontSize);
    const x = pageX + (line.x || 0) + cursorX + measureTextWidth(font, prefix);
    const y = pageTop + line.y + baselineOffset;

    if (segmentText.length > 0) {
      segments.push({ text: segmentText, x, y, font, color });
    }

    cursorX += runWidth;
  }

  return segments;
};

export const buildDecorationDrawData = ({
  layout,
  layoutIndex,
  doc,
  decorations,
  scrollTop,
  viewportWidth,
  textLength,
  docPosToTextOffset,
  coordsAtPos,
}: {
  layout: any;
  layoutIndex: any;
  doc: any;
  decorations?: CanvasDecoration[] | DecorationSet | null;
  scrollTop: number;
  viewportWidth: number;
  textLength: number;
  docPosToTextOffset: (doc: any, pos: number) => number;
  coordsAtPos: (layout: any, offset: number, scrollTop: number, viewportWidth: number, textLength: number) => any;
}): DecorationDrawData | null => {
  if (!layout || !doc) {
    return null;
  }

  const items = normalizeDecorations(decorations as any);
  if (items.length === 0) {
    return null;
  }

  const inlineRects: DecorationRect[] = [];
  const nodeRects: DecorationRect[] = [];
  const textSegments: DecorationTextSegment[] = [];
  const widgets: DecorationWidget[] = [];

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageSpan = layout.pageHeight + layout.pageGap;
  const lineItems = collectLineItems(layout, layoutIndex);

  for (const decoration of items) {
    if (!decoration || !decoration.spec) {
      continue;
    }

    if (decoration.type === "widget") {
      if (typeof decoration.spec.render !== "function" || typeof coordsAtPos !== "function") {
        continue;
      }
      const offset = docPosToTextOffset(doc, decoration.from);
      const rect = coordsAtPos(layout, offset, scrollTop, viewportWidth, textLength);
      if (!rect) {
        continue;
      }
      widgets.push({ x: rect.x, y: rect.y, height: rect.height, decoration });
      continue;
    }

    const fromOffset = docPosToTextOffset(doc, decoration.from);
    const toOffset = docPosToTextOffset(doc, decoration.to);
    if (!Number.isFinite(fromOffset) || !Number.isFinite(toOffset)) {
      continue;
    }

    const rects = selectionToRects(
      layout,
      fromOffset,
      toOffset,
      scrollTop,
      viewportWidth,
      textLength,
      layoutIndex
    );

    if (rects.length > 0) {
      const target = decoration.type === "inline" ? inlineRects : nodeRects;
      for (const rect of rects) {
        target.push({ ...rect, decoration });
      }
    }

    if (decoration.spec.textColor) {
      const minOffset = Math.max(0, Math.min(fromOffset, toOffset));
      const maxOffset = Math.max(minOffset, Math.min(Math.max(fromOffset, toOffset), textLength));

      for (const item of lineItems) {
        const line = item.line;
        if (!line) {
          continue;
        }
        if (maxOffset <= line.start || minOffset >= line.end) {
          continue;
        }
        const start = Math.max(minOffset, line.start);
        const end = Math.min(maxOffset, line.end);
        if (end <= start) {
          continue;
        }
        const pageTop = item.pageIndex * pageSpan - scrollTop;
        const segments = collectTextSegments({
          line,
          pageX,
          pageTop,
          rangeStart: start,
          rangeEnd: end,
          layout,
          color: decoration.spec.textColor,
        });
        if (segments.length > 0) {
          textSegments.push(...segments);
        }
      }
    }
  }

  return { inlineRects, nodeRects, textSegments, widgets };
};




