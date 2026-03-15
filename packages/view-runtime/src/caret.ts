/*
 * 鏂囦欢璇存槑锛氬厜鏍?鍛戒腑閫昏緫銆?
 * 涓昏鑱岃矗锛氭牴鎹枃鏈亸绉昏绠楀厜鏍囦綅缃紱鏍规嵁鍧愭爣鍙嶇畻鍋忕Щ銆?
 */

import { measureTextWidth, getFontSize } from "./measure";
import { hasLayoutCapability, isLineVisualBlock } from "./layoutSemantics";

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

const getLineBlockStart = (line, page = null) => {
  if (Number.isFinite(line?.blockStart)) {
    return Number(line.blockStart) + getPageOffsetDelta(page);
  }
  return getLineStart(line, page);
};

const getBoxTop = (box) => (Number.isFinite(box?.y) ? Number(box.y) : null);

const getBoxLeft = (box) => (Number.isFinite(box?.x) ? Number(box.x) : null);

const getBoxWidth = (box) => (Number.isFinite(box?.width) ? Math.max(0, Number(box.width)) : null);

const getBoxHeight = (box) => (Number.isFinite(box?.height) ? Math.max(0, Number(box.height)) : null);

const getBoxBottom = (box) => {
  const top = getBoxTop(box);
  const height = getBoxHeight(box);
  if (top == null || height == null) {
    return null;
  }
  return top + height;
};

const getLineXForOffset = (line, offset, fallbackFont, page = null) => {
  const lineStart = getLineStart(line, page);
  if (!line.runs || line.runs.length === 0) {
    return measureTextWidth(fallbackFont, line.text.slice(0, Math.max(0, offset - lineStart)));
  }

  let x = 0;
  const lineOffsetDelta = getRunOffsetDelta(line, page);

  for (const run of line.runs) {
    const runFont = run.font || fallbackFont;

    const runStart = Number.isFinite(run.start) ? Number(run.start) + lineOffsetDelta : 0;

    const runEnd = Number.isFinite(run.end) ? Number(run.end) + lineOffsetDelta : runStart;

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

const getFontForOffset = (line, offset, fallbackFont, page = null) => {
  if (!line.runs || line.runs.length === 0) {
    return fallbackFont;
  }

  const lineOffsetDelta = getRunOffsetDelta(line, page);
  for (const run of line.runs) {
    const runStart = Number.isFinite(run.start) ? Number(run.start) + lineOffsetDelta : 0;
    const runEnd = Number.isFinite(run.end) ? Number(run.end) + lineOffsetDelta : runStart;
    if (offset >= runStart && offset <= runEnd) {
      return run.font || fallbackFont;
    }
  }

  return fallbackFont;
};

const getBaselineOffset = (lineHeight, fontSize) => Math.max(0, (lineHeight - fontSize) / 2);

const isVisualBlockLine = (line, page = null) => {
  const lineStart = getLineStart(line, page);
  const lineEnd = getLineEnd(line, page);
  if (!line || !Number.isFinite(lineStart) || !Number.isFinite(lineEnd)) {
    return false;
  }
  if (lineEnd <= lineStart) {
    return false;
  }
  return isLineVisualBlock(line);
};

export function findLineForOffset(layout, offset, textLength, options = null) {
  if (!layout || layout.pages.length === 0) {
    return null;
  }

  const clamped = Math.max(0, Math.min(offset, textLength));
  const preferBoundary = options?.preferBoundary === "end" ? "end" : "start";

  let emptyHit = null;
  let lineEndHit = null;
  let rangeHit = null;
  let startHit = null;
  let visualStartHit = null;

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      const lineStart = getLineStart(line, page);
      const lineEnd = getLineEnd(line, page);
      const hit = { pageIndex: p, lineIndex: l, line, page, start: lineStart, end: lineEnd };
      if (lineStart === lineEnd && clamped === lineStart && !emptyHit) {
        emptyHit = hit;
      }

      if (clamped >= lineStart && clamped < lineEnd) {
        if (!rangeHit) {
          rangeHit = hit;
        }
        if (clamped === lineStart) {
          if (!startHit) {
            startHit = hit;
          }
          if (isVisualBlockLine(line, page) && !visualStartHit) {
            visualStartHit = hit;
          }
        }
      }

      if (clamped == lineEnd && lineEnd > lineStart) {
        if (!lineEndHit) {
          lineEndHit = {
            pageIndex: p,
            lineIndex: l,
            line,
            page,
            start: lineStart,
            end: lineEnd,
            isLineEnd: true,
          };
        }
      }
    }
  }
  if (preferBoundary === "end") {
    if (lineEndHit) {
      return lineEndHit;
    }
    if (rangeHit) {
      return rangeHit;
    }
    if (emptyHit) {
      return emptyHit;
    }
    if (startHit) {
      return startHit;
    }
    if (visualStartHit) {
      return visualStartHit;
    }
  } else {
    if (visualStartHit) {
      return visualStartHit;
    }
    if (startHit) {
      return startHit;
    }
    if (rangeHit) {
      return rangeHit;
    }
    if (emptyHit) {
      // Prefer an actual empty-line hit over the previous line end at the same offset.
      // This keeps caret placement stable after Enter creates an empty paragraph.
      return emptyHit;
    }
    if (lineEndHit) {
      return lineEndHit;
    }
  }

  const lastPage = layout.pages[layout.pages.length - 1];

  const lastLine = lastPage.lines[lastPage.lines.length - 1];

  return {
    pageIndex: layout.pages.length - 1,

    lineIndex: lastPage.lines.length - 1,

    line: lastLine,
    page: lastPage,
    start: getLineStart(lastLine, lastPage),
    end: getLineEnd(lastLine, lastPage),
  };
}

export function offsetAtX(font, line, x, page = null) {
  const lineStart = getLineStart(line, page);
  const lineEnd = getLineEnd(line, page);
  if (isVisualBlockLine(line, page)) {
    const width = Math.max(0, Number(line.width) || 0);
    if (width <= 0) {
      return lineStart;
    }
    return x < width / 2 ? lineStart : lineEnd;
  }

  if (x <= 0) {
    return lineStart;
  }

  if (line.runs && line.runs.length > 0) {
    let acc = 0;
    const lineOffsetDelta = getRunOffsetDelta(line, page);

    for (const run of line.runs) {
      const runFont = run.font || font;
      const runStart = Number.isFinite(run.start) ? Number(run.start) + lineOffsetDelta : 0;

      const runWidth =
        typeof run.width === "number" ? run.width : measureTextWidth(runFont, run.text);

      if (x <= acc + runWidth) {
        let runAcc = 0;

        for (let i = 0; i < run.text.length; i += 1) {
          const ch = run.text[i];

          const w = measureTextWidth(runFont, ch);

          const mid = acc + runAcc + w / 2;

          if (x < mid) {
            return runStart + i;
          }

          runAcc += w;
        }

        return runStart + run.text.length;
      }

      acc += runWidth;
    }

    return lineEnd;
  }

  let acc = 0;

  for (let i = 0; i < line.text.length; i += 1) {
    const ch = line.text[i];

    const w = measureTextWidth(font, ch);

    const mid = acc + w / 2;

    if (x < mid) {
      return lineStart + i;
    }

    acc += w;
  }

  return lineStart + line.text.length;
}

/* 鍏夋爣鐭╁舰锛氭牴鎹亸绉诲畾浣嶅埌琛岋紝鍐嶆寜瀛椾綋澶у皬灞呬腑 */

export function getCaretRect(layout, offset, scrollTop, viewportWidth, textLength, options = null) {
  const info = options?.lineInfo ?? findLineForOffset(layout, offset, textLength, options);

  if (!info) {
    return null;
  }

  const { pageIndex, line } = info;
  const page = info.page || layout.pages[pageIndex];

  const isLineEnd = info.isLineEnd === true;

  const pageSpan = layout.pageHeight + layout.pageGap;

  const pageTop = pageIndex * pageSpan - scrollTop;

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const lineHeight = getLineHeight(line, layout);
  if (isVisualBlockLine(line, page)) {
    const width = Math.max(0, Number(line.width) || 0);
    const caretX = isLineEnd ? width : 0;
    return {
      x: pageX + line.x + caretX,
      y: pageTop + line.y,
      height: lineHeight,
    };
  }

  const lineStart = getLineStart(line, page);
  const localIndex = Math.max(0, Math.min(offset - lineStart, line.text.length));
  const localX = getLineXForOffset(line, lineStart + localIndex, layout.font, page);
  const caretX = isLineEnd ? Math.max(localX, line.width || localX) : localX;
  const caretFont = getFontForOffset(line, offset, layout.font, page);
  const fontSize = getFontSize(caretFont);
  const baselineOffset = getBaselineOffset(lineHeight, fontSize);

  return {
    x: pageX + line.x + caretX,
    y: pageTop + line.y + baselineOffset,
    height: fontSize,
  };
}

const pickLineAtPoint = (lineItems, x, pageX) => {
  if (lineItems.length === 0) {
    return null;
  }

  if (lineItems.length === 1) {
    return lineItems[0];
  }

  let best = null;

  let bestScore = Number.POSITIVE_INFINITY;

  for (const item of lineItems) {
    const line = item.line;
    const padding = line.cellPadding || 0;

    const cellWidth = line.cellWidth || line.width || 0;

    const left = pageX + line.x - padding;

    const right = left + cellWidth + padding * 2;

    if (x >= left && x <= right) {
      return item;
    }

    const distance = x < left ? left - x : x - right;

    if (distance < bestScore) {
      bestScore = distance;

      best = item;
    }
  }

  return best || lineItems[0];
};

const getOwnerPathInfo = (line, targetPathKey) => {
  const owners = Array.isArray(line?.fragmentOwners) ? line.fragmentOwners : [];
  let pathKey = "";
  const pathKeys = [];

  for (let index = 0; index < owners.length; index += 1) {
    const owner = owners[index];
    if (!owner?.key) {
      continue;
    }
    pathKey = pathKey ? `${pathKey}/${owner.key}` : owner.key;
    pathKeys.push(pathKey);
    if (pathKey === targetPathKey) {
      return {
        owners,
        pathKeys,
        index: pathKeys.length - 1,
      };
    }
  }

  return null;
};

const getSharedBoundaryOwnerKey = (prevLine, nextLine) => {
  const prevOwners = Array.isArray(prevLine?.fragmentOwners) ? prevLine.fragmentOwners : [];
  const nextOwners = Array.isArray(nextLine?.fragmentOwners) ? nextLine.fragmentOwners : [];
  const limit = Math.min(prevOwners.length, nextOwners.length);
  let sharedKey = null;

  for (let index = 0; index < limit; index += 1) {
    const prevOwner = prevOwners[index];
    const nextOwner = nextOwners[index];
    if (!prevOwner?.key || prevOwner.key !== nextOwner?.key) {
      break;
    }
    if (hasLayoutCapability(prevOwner, "content-container")) {
      sharedKey = prevOwner.key;
    }
  }

  return sharedKey;
};

const isDistinctBlockBoundary = (prevLine, nextLine, page = null) => {
  if (!prevLine || !nextLine || prevLine === nextLine) {
    return false;
  }

  if (prevLine.blockId != null && nextLine.blockId != null) {
    return prevLine.blockId !== nextLine.blockId;
  }

  const prevBlockStart = getLineBlockStart(prevLine, page);
  const nextBlockStart = getLineBlockStart(nextLine, page);
  if (Number.isFinite(prevBlockStart) && Number.isFinite(nextBlockStart)) {
    return (
      Number(prevBlockStart) !== Number(nextBlockStart) ||
      String(prevLine.blockType || "") !== String(nextLine.blockType || "")
    );
  }

  return (
    getLineStart(prevLine, page) !== getLineStart(nextLine, page) ||
    getLineEnd(prevLine, page) !== getLineEnd(nextLine, page) ||
    String(prevLine.blockType || "") !== String(nextLine.blockType || "")
  );
};

const lineMatchesContainer = (line, containerKey) => !!getOwnerPathInfo(line, containerKey);

const getGapBlockKey = (line, page, childPathKey = null) => {
  if (childPathKey) {
    return `owner:${childPathKey}`;
  }
  if (line?.blockId != null) {
    return `block:${String(line.blockId)}`;
  }
  const blockStart = getLineBlockStart(line, page);
  if (Number.isFinite(blockStart)) {
    return `range:${blockStart}:${String(line?.blockType || "")}`;
  }
  return `line:${getLineStart(line, page)}:${getLineEnd(line, page)}:${String(line?.blockType || "")}`;
};

const collectGapContainers = (boxes, localX, localY, result, depth = 0) => {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    return;
  }

  for (const box of boxes) {
    if (!box) {
      continue;
    }

    const top = getBoxTop(box);
    const bottom = getBoxBottom(box);
    const left = getBoxLeft(box);
    const width = getBoxWidth(box);
    const withinY = top != null && bottom != null && localY >= top && localY < bottom;
    const withinX =
      left == null || width == null ? true : localX >= left - 12 && localX <= left + width + 12;

    if (withinY && withinX && hasLayoutCapability(box, "content-container")) {
      result.push({ box, depth });
    }

    if (Array.isArray(box.children) && box.children.length > 0 && withinY) {
      collectGapContainers(box.children, localX, localY, result, depth + 1);
    }
  }
};

const buildContainerBlockGroups = (page, containerBox, layout) => {
  if (!page?.lines?.length || !containerBox?.key) {
    return [];
  }

  const groups = [];

  for (let index = 0; index < page.lines.length; index += 1) {
    const line = page.lines[index];
    if (!lineMatchesContainer(line, containerBox.key)) {
      continue;
    }

    const ownerInfo = getOwnerPathInfo(line, containerBox.key);
    const childPathKey =
      ownerInfo && ownerInfo.index + 1 < ownerInfo.pathKeys.length
        ? ownerInfo.pathKeys[ownerInfo.index + 1]
        : null;
    const key = getGapBlockKey(line, page, childPathKey);
    const lineStart = getLineStart(line, page);
    const lineEnd = getLineEnd(line, page);
    const lineTop = Number.isFinite(line?.y) ? Number(line.y) : 0;
    const lineBottom = lineTop + getLineHeight(line, layout);
    const lastGroup = groups.length > 0 ? groups[groups.length - 1] : null;

    if (lastGroup && lastGroup.key === key) {
      lastGroup.start = Math.min(lastGroup.start, lineStart);
      lastGroup.end = Math.max(lastGroup.end, lineEnd);
      lastGroup.top = Math.min(lastGroup.top, lineTop);
      lastGroup.bottom = Math.max(lastGroup.bottom, lineBottom);
      lastGroup.lastLine = line;
      lastGroup.lastLineIndex = index;
      continue;
    }

    groups.push({
      key,
      start: lineStart,
      end: lineEnd,
      top: lineTop,
      bottom: lineBottom,
      firstLine: line,
      firstLineIndex: index,
      lastLine: line,
      lastLineIndex: index,
    });
  }

  return groups;
};

const createGapHit = (pageIndex, page, pageX, x, line, lineIndex, offset) => ({
  offset,
  localX: Math.max(0, x - pageX - (Number(line?.x) || 0)),
  pageIndex,
  lineIndex,
  line,
  page,
});

const resolveBoxGapHit = (page, pageIndex, localY, x, pageX, layout) => {
  if (!Array.isArray(page?.boxes) || page.boxes.length === 0) {
    return null;
  }

  const localX = x - pageX;
  const candidates = [];
  collectGapContainers(page.boxes, localX, localY, candidates);
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.depth !== b.depth) {
      return b.depth - a.depth;
    }
    const aHeight = getBoxHeight(a.box) ?? Number.POSITIVE_INFINITY;
    const bHeight = getBoxHeight(b.box) ?? Number.POSITIVE_INFINITY;
    if (aHeight !== bHeight) {
      return aHeight - bHeight;
    }
    const aTop = getBoxTop(a.box) ?? 0;
    const bTop = getBoxTop(b.box) ?? 0;
    return aTop - bTop;
  });

  for (const candidate of candidates) {
    const containerBox = candidate.box;
    const containerTop = getBoxTop(containerBox);
    const containerBottom = getBoxBottom(containerBox);
    if (containerTop == null || containerBottom == null) {
      continue;
    }

    const groups = buildContainerBlockGroups(page, containerBox, layout);
    if (groups.length === 0) {
      continue;
    }

    const firstGroup = groups[0];
    if (localY >= containerTop && localY < firstGroup.top) {
      return createGapHit(
        pageIndex,
        page,
        pageX,
        x,
        firstGroup.firstLine,
        firstGroup.firstLineIndex,
        firstGroup.start
      );
    }

    for (let index = 0; index < groups.length - 1; index += 1) {
      const previous = groups[index];
      const next = groups[index + 1];
      if (localY < previous.bottom || localY >= next.top) {
        continue;
      }

      const gapMid = previous.bottom + (next.top - previous.bottom) / 2;
      const usePrevious = localY < gapMid;
      return usePrevious
        ? createGapHit(
            pageIndex,
            page,
            pageX,
            x,
            previous.lastLine,
            previous.lastLineIndex,
            previous.end
          )
        : createGapHit(
            pageIndex,
            page,
            pageX,
            x,
            next.firstLine,
            next.firstLineIndex,
            next.start
          );
    }

    const lastGroup = groups[groups.length - 1];
    if (localY >= lastGroup.bottom && localY < containerBottom) {
      return createGapHit(
        pageIndex,
        page,
        pageX,
        x,
        lastGroup.lastLine,
        lastGroup.lastLineIndex,
        lastGroup.end
      );
    }
  }

  return null;
};

const resolveLineGapHit = (page, pageIndex, localY, x, pageX, layout) => {
  if (!page?.lines?.length) {
    return null;
  }

  let previous = null;
  let next = null;

  for (let index = 0; index < page.lines.length; index += 1) {
    const line = page.lines[index];
    const top = Number.isFinite(line?.y) ? Number(line.y) : 0;
    const bottom = top + getLineHeight(line, layout);

    if (bottom <= localY) {
      previous = { line, index, top, bottom };
      continue;
    }

    if (top > localY) {
      next = { line, index, top, bottom };
      break;
    }
  }

  if (!previous || !next || localY < previous.bottom || localY >= next.top) {
    return null;
  }

  if (!getSharedBoundaryOwnerKey(previous.line, next.line)) {
    return null;
  }

  if (!isDistinctBlockBoundary(previous.line, next.line, page)) {
    return null;
  }

  const gapMid = previous.bottom + (next.top - previous.bottom) / 2;
  const usePrevious = localY < gapMid;
  const target = usePrevious ? previous : next;
  const fallbackOffset = getLineStart(target.line, page);
  const offset = usePrevious
    ? getLineEnd(previous.line, page)
    : getLineStart(next.line, page);

  return createGapHit(pageIndex, page, pageX, x, target.line, target.index, offset);
};

/* 鍛戒腑娴嬭瘯锛氭牴鎹潗鏍囬€夋嫨鏈€杩戣骞跺弽绠楀亸绉?*/

export function getCaretFromPoint(layout, x, y, scrollTop, viewportWidth, textLength) {
  if (!layout || layout.pages.length === 0) {
    return null;
  }

  const pageSpan = layout.pageHeight + layout.pageGap;

  const pageIndex = Math.floor((y + scrollTop) / pageSpan);

  if (pageIndex < 0 || pageIndex >= layout.pages.length) {
    return null;
  }

  const page = layout.pages[pageIndex];

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);

  const localY = y + scrollTop - pageIndex * pageSpan;

  const linesAtY = [];
  for (let index = 0; index < page.lines.length; index += 1) {
    const line = page.lines[index];
    const lineHeight = getLineHeight(line, layout);
    if (localY >= line.y && localY < line.y + lineHeight) {
      linesAtY.push({ line, index });
    }
  }

  const pickedLine = pickLineAtPoint(linesAtY, x, pageX);
  let line = pickedLine?.line ?? null;
  let lineIndex = Number.isFinite(pickedLine?.index) ? Number(pickedLine.index) : null;

  if (!line) {
    const gapHit =
      resolveBoxGapHit(page, pageIndex, localY, x, pageX, layout) ||
      resolveLineGapHit(page, pageIndex, localY, x, pageX, layout);
    if (gapHit) {
      return gapHit;
    }
    const closest = page.lines.reduce((best, candidate, index) => {
      const lineHeight = getLineHeight(candidate, layout);

      const center = candidate.y + lineHeight / 2;

      const delta = Math.abs(center - localY);

      if (!best || delta < best.delta) {
        return { line: candidate, index, delta };
      }

      return best;
    }, null);
    line = closest?.line ?? null;
    lineIndex =
      Number.isFinite(closest?.index) ? Number(closest.index) : lineIndex;
  }

  if (!line) {
    return null;
  }

  const localX = Math.max(0, x - pageX - line.x);
  let offset = offsetAtX(layout.font, line, localX, page);
  if (isVisualBlockLine(line, page)) {
    const lineHeight = getLineHeight(line, layout);
    const localLineY = Math.max(0, y + scrollTop - pageIndex * pageSpan - line.y);
    offset = localLineY < lineHeight / 2 ? getLineStart(line, page) : getLineEnd(line, page);
  }

  return {
    offset,

    localX,

    pageIndex,

    lineIndex: Number.isFinite(lineIndex) ? Number(lineIndex) : page.lines.indexOf(line),
    line,
    page,
    start: getLineStart(line, page),
    end: getLineEnd(line, page),
  };
}

