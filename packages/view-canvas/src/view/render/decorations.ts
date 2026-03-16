import { getFontSize, measureTextWidth } from "../measure";
import { selectionToRects } from "./selection";
import {
  collectAllLayoutBoxesForRange,
  collectTextLineItemsForRange,
  resolveEmptyLineWidth,
  resolveLayoutBoxRect,
  resolveLineVisualBox,
} from "./geometry";
import { normalizeDecorations, type CanvasDecoration, type DecorationSet } from "../decorations";
import { getLinesInRange } from "../caret";
import { resolveListMarker } from "lumenpage-render-engine";

// Cache for decoration draw data to avoid recomputing on every frame
const decorationCache = new Map<
  string,
  {
    decorations: any;
    scrollTop: number;
    viewportWidth: number;
    layoutToken: number;
    data: DecorationDrawData | null;
  }
>();

const getDecorationCacheKey = (
  decorations: any,
  scrollTop: number,
  viewportWidth: number,
  layoutToken: number
): string => {
  // Use scrollTop with a threshold (rounded to nearest 50px) to avoid cache misses
  // on every tiny scroll while still invalidating when scrolling to a different "zone"
  const scrollBucket = Math.round(scrollTop / 50) * 50;

  if (!decorations || !Array.isArray(decorations) || decorations.length === 0) {
    // Use stable layout token for empty decorations too
    const stableLayoutToken = Math.floor(layoutToken / 4);
    return `empty_${stableLayoutToken}_${scrollBucket}_${viewportWidth}`;
  }
  const first = decorations[0];
  const last = decorations[decorations.length - 1];
  const hash = `${layoutToken}_${decorations.length}_${first?.from ?? 0}_${first?.to ?? 0}_${last?.from ?? 0}_${last?.to ?? 0}_${scrollBucket}_${viewportWidth}`;
  return hash;
};

export const clearDecorationCache = () => {
  decorationCache.clear();
};

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

const getLineOffsetDelta = (line) =>
  Number.isFinite(line?.__offsetDelta) ? Number(line.__offsetDelta) : 0;

const getPageOffsetDelta = (page) =>
  Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0;

const getRunOffsetDelta = (line, page = null) => getLineOffsetDelta(line) + getPageOffsetDelta(page);

const getLineStart = (line, page = null) =>
  Number.isFinite(line?.start) ? Number(line.start) + getPageOffsetDelta(page) : 0;

const getLineEnd = (line, page = null) => {
  const start = getLineStart(line, page);
  return Number.isFinite(line?.end) ? Number(line.end) + getPageOffsetDelta(page) : start;
};

const getBaselineOffset = (lineHeight, fontSize) => Math.max(0, (lineHeight - fontSize) / 2);

const forEachLineItem = (layout, layoutIndex, visitor) => {
  const pageEntries = Array.isArray(layoutIndex?.pageEntries) ? layoutIndex.pageEntries : null;
  if (pageEntries) {
    for (const pageEntry of pageEntries) {
      const lines = Array.isArray(pageEntry?.page?.lines) ? pageEntry.page.lines : [];
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const start = getLineStart(line, pageEntry.page);
        const end = getLineEnd(line, pageEntry.page);
        visitor({
          pageIndex: pageEntry.pageIndex,
          lineIndex,
          line,
          start,
          end,
        });
      }
    }
    return;
  }

  if (layoutIndex?.lines?.length) {
    for (const item of layoutIndex.lines) {
      visitor(item);
    }
    return;
  }

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      const start = getLineStart(line, page);
      const end = getLineEnd(line, page);
      visitor({
        pageIndex: p,
        lineIndex: l,
        line,
        start,
        end,
      });
    }
  }
};

const getLineItemsInRange = (layout, layoutIndex, minOffset, maxOffset) => {
  if (
    layoutIndex &&
    typeof getLinesInRange === "function" &&
    Number.isFinite(minOffset) &&
    Number.isFinite(maxOffset)
  ) {
    return getLinesInRange(layoutIndex, minOffset, maxOffset);
  }

  const items = [];
  forEachLineItem(layout, layoutIndex, (item) => {
    const start = Number.isFinite(item?.start) ? Number(item.start) : 0;
    const end = Number.isFinite(item?.end) ? Number(item.end) : start;
    if (end < minOffset || start > maxOffset) {
      return;
    }
    items.push(item);
  });
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
  page,
  color,
}) => {
  const segments = [];
  const lineHeight = getLineHeight(line, layout);
  const lineStart = getLineStart(line, page);

  if (!line.runs || line.runs.length === 0) {
    const font = layout.font;
    const text = line.text || "";
    const startIndex = Math.max(0, rangeStart - lineStart);
    const endIndex = Math.max(startIndex, Math.min(rangeEnd - lineStart, text.length));
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
  const lineOffsetDelta = getRunOffsetDelta(line, page);

  for (const run of line.runs) {
    const runStart = Number.isFinite(run.start) ? Number(run.start) + lineOffsetDelta : 0;
    const runEnd = Number.isFinite(run.end) ? Number(run.end) + lineOffsetDelta : runStart;
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

const resolveContainerVisualLeft = (line: any, pageX: number, layout: any) => {
  const containers = Array.isArray(line?.containers) ? line.containers : null;
  if (!containers || containers.length === 0) {
    return null;
  }

  let visualLeft: number | null = null;
  for (const container of containers) {
    if (!container) {
      continue;
    }
    const baseX = Number.isFinite(container.baseX)
      ? Number(container.baseX)
      : layout.margin.left + (Number(container.offset) || 0);
    const borderInset = Number.isFinite(container.borderInset) ? Number(container.borderInset) : 0;
    const containerLeft = pageX + baseX + borderInset;
    if (visualLeft == null) {
      visualLeft = containerLeft;
      continue;
    }
    visualLeft = Math.min(visualLeft, containerLeft);
  }

  return visualLeft;
};

export const buildDecorationDrawData = (
  {
    layout,
    layoutIndex,
    doc,
    decorations,
    scrollTop,
    viewportWidth,
    textLength,
    docPosToTextOffset,
    coordsAtPos,
    layoutToken,
  }: {
    layout: any;
    layoutIndex: any;
    doc: any;
    decorations?: CanvasDecoration[] | DecorationSet | null;
    scrollTop: number;
    viewportWidth: number;
    textLength: number;
    docPosToTextOffset: (doc: any, pos: number) => number;
    coordsAtPos: (
      layout: any,
      offset: number,
      scrollTop: number,
      viewportWidth: number,
      textLength: number,
      options?: any
    ) => any;
    layoutToken?: number;
  },
  skipCache = false
): DecorationDrawData | null => {
  if (!layout || !doc) {
    return null;
  }

  // Use caching to avoid recomputing on every frame
  // Cache key includes layout token, scroll position, viewport, and decoration info
  const token = Number.isFinite(layoutToken) ? layoutToken : layout.__version ?? 0;
  const cacheKey = getDecorationCacheKey(decorations, scrollTop, viewportWidth, token);

  if (!skipCache) {
    const cached = decorationCache.get(cacheKey);
    if (cached && cached.data) {
      return cached.data;
    }
  }

  const items = normalizeDecorations(decorations as any);
  if (items.length === 0) {
    // Cache empty results too
    decorationCache.set(cacheKey, { decorations: null, scrollTop, viewportWidth, layoutToken: token, data: null });
    return null;
  }

  const inlineRects: DecorationRect[] = [];
  const nodeRects: DecorationRect[] = [];
  const textSegments: DecorationTextSegment[] = [];
  const widgets: DecorationWidget[] = [];

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const pageSpan = layout.pageHeight + layout.pageGap;
  const nodeOutlineUnion = new Map<
    string,
    {
      decoration: CanvasDecoration;
      left: number;
      top: number;
      right: number;
      bottom: number;
    }
  >();

  for (let decorationIndex = 0; decorationIndex < items.length; decorationIndex += 1) {
    const decoration = items[decorationIndex];
    if (!decoration || !decoration.spec) {
      continue;
    }

    if (decoration.type === "widget") {
      if (typeof decoration.spec.render !== "function" || typeof coordsAtPos !== "function") {
        continue;
      }
      const offset = docPosToTextOffset(doc, decoration.from);
      const rect = coordsAtPos(layout, offset, scrollTop, viewportWidth, textLength, {
        layoutIndex,
      });
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

    if (decoration.type === "node" && decoration.spec?.blockOutline) {
      // Node decorations use [from, to) positions. For block-outline hit-testing, resolve the
      // end bound inside the node (`to - 1`) so adjacent block separators don't leak into
      // neighbor empty paragraphs after Enter split.
      const startPos = Math.min(decoration.from, decoration.to);
      const endPos = Math.max(decoration.from, decoration.to);
      const contentEndPos = endPos > startPos ? endPos - 1 : endPos;
      const outlineFromOffset = docPosToTextOffset(doc, startPos);
      const outlineToOffset = docPosToTextOffset(doc, contentEndPos);
      if (!Number.isFinite(outlineFromOffset) || !Number.isFinite(outlineToOffset)) {
        continue;
      }
      const minOffset = Math.max(0, Math.min(outlineFromOffset, outlineToOffset));
      const maxOffset = Math.max(minOffset, Math.min(Math.max(outlineFromOffset, outlineToOffset), textLength));
      const lineItems = getLineItemsInRange(layout, layoutIndex, minOffset, maxOffset);
      const seedLine = lineItems[0]?.line ?? null;
      const seedBlockId = seedLine?.blockId ?? null;
      const seedBlockType = seedLine?.blockType ?? null;
      const boxHits = collectAllLayoutBoxesForRange(layout, minOffset, maxOffset, {
        exact: true,
        layoutIndex,
        predicate: ({ box }) => {
          if (!box) {
            return false;
          }
          if (seedBlockId != null && box?.blockId != null) {
            return String(box.blockId) === String(seedBlockId);
          }
          if (seedBlockType) {
            return String(box?.type || "") === String(seedBlockType);
          }
          return true;
        },
      });
      if (boxHits.length > 0) {
        for (const hit of boxHits) {
          const rect = resolveLayoutBoxRect({
            layout,
            box: hit.box,
            pageIndex: hit.pageIndex,
            scrollTop,
            viewportWidth,
          });
          if (!rect || rect.width <= 0 || rect.height <= 0) {
            continue;
          }
          nodeRects.push({
            ...rect,
            decoration,
          });
        }
        continue;
      }
      for (const item of lineItems) {
        const line = item?.line;
        if (!line) {
          continue;
        }
        const page = layout.pages[item.pageIndex] ?? null;
        const lineStart = Number.isFinite(item?.start) ? Number(item.start) : getLineStart(line, page);
        const lineEnd = Number.isFinite(item?.end) ? Number(item.end) : getLineEnd(line, page);
        const isEmptyLine = lineStart === lineEnd;
        if (isEmptyLine) {
          if (minOffset > lineStart || maxOffset < lineEnd) {
            continue;
          }
        } else if (maxOffset <= lineStart || minOffset >= lineEnd) {
          continue;
        }

        const pageTop = item.pageIndex * pageSpan - scrollTop;
        const lineHeight = getLineHeight(line, layout);

        const visualBox = resolveLineVisualBox(line, layout);
        const lineLeft = pageX + visualBox.lineX;
        const lineWidth = Math.max(
          1,
          visualBox.lineWidth || (isEmptyLine ? resolveEmptyLineWidth(line, layout) : 0)
        );
        let left = lineLeft;
        let right = lineLeft + lineWidth;
        const marker = resolveListMarker(line, layout);
        if (marker) {
          const markerWidth = Math.max(0, Number(marker.width) || 0);
          const markerGap = Math.max(0, Number(marker.gap) || 0);
          left = Math.min(left, lineLeft - markerGap - markerWidth);
        }
        const containerVisualLeft = resolveContainerVisualLeft(line, pageX, layout);
        if (Number.isFinite(containerVisualLeft)) {
          left = Math.min(left, Number(containerVisualLeft));
        }
        // 浠ｇ爜鍧楁槸瀹瑰櫒鑳屾櫙锛坢argin 鍐呭叏瀹斤級+ 鍐呴儴鏂囧瓧锛坧adding 鍚庤捣濮嬶級锛?
        // 閫変腑妗嗛渶瑕佸榻愬鍣ㄨ竟鐣岃€屼笉鏄枃瀛楄捣濮嬩綅缃€?
        if (visualBox.hasOuterBounds) {
          left = Math.min(left, pageX + visualBox.outerX);
          right = Math.max(right, pageX + visualBox.outerX + visualBox.outerWidth);
        }
        const top = pageTop + line.y;
        const bottom = top + lineHeight;
        const unionKey = `${decorationIndex}:${item.pageIndex}`;
        const prev = nodeOutlineUnion.get(unionKey);

        if (!prev) {
          nodeOutlineUnion.set(unionKey, { decoration, left, top, right, bottom });
          continue;
        }
        prev.left = Math.min(prev.left, left);
        prev.top = Math.min(prev.top, top);
        prev.right = Math.max(prev.right, right);
        prev.bottom = Math.max(prev.bottom, bottom);
      }
    } else {
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
    }

    if (decoration.spec.textColor) {
      const minOffset = Math.max(0, Math.min(fromOffset, toOffset));
      const maxOffset = Math.max(minOffset, Math.min(Math.max(fromOffset, toOffset), textLength));
      const textLineItems = collectTextLineItemsForRange(layout, minOffset, maxOffset, {
        layoutIndex,
      });
      const lineItems =
        textLineItems.length > 0
          ? textLineItems
          : getLineItemsInRange(layout, layoutIndex, minOffset, maxOffset);
      for (const item of lineItems) {
        const line = item.line;
        if (!line) {
          continue;
        }
        const page = layout.pages[item.pageIndex] ?? null;
        const lineStart = Number.isFinite(item?.start) ? Number(item.start) : getLineStart(line, page);
        const lineEnd = Number.isFinite(item?.end) ? Number(item.end) : getLineEnd(line, page);
        if (maxOffset <= lineStart || minOffset >= lineEnd) {
          continue;
        }
        const start = Math.max(minOffset, lineStart);
        const end = Math.min(maxOffset, lineEnd);
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
          page,
          color: decoration.spec.textColor,
        });
        if (segments.length > 0) {
          textSegments.push(...segments);
        }
      }
    }
  }

  if (nodeOutlineUnion.size > 0) {
    for (const union of nodeOutlineUnion.values()) {
      const width = Math.max(0, union.right - union.left);
      const height = Math.max(0, union.bottom - union.top);
      if (width <= 0 || height <= 0) {
        continue;
      }
      nodeRects.push({
        x: union.left,
        y: union.top,
        width,
        height,
        decoration: union.decoration,
      });
    }
  }

  const result: DecorationDrawData = { inlineRects, nodeRects, textSegments, widgets };

  // Cache the result with scroll bucket to reduce cache misses on small scrolls
  decorationCache.set(cacheKey, { decorations: items, scrollTop, viewportWidth, layoutToken: token, data: result });

  return result;
};




