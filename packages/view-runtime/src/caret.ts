/*
 * 鏂囦欢璇存槑锛氬厜鏍?鍛戒腑閫昏緫銆?
 * 涓昏鑱岃矗锛氭牴鎹枃鏈亸绉昏绠楀厜鏍囦綅缃紱鏍规嵁鍧愭爣鍙嶇畻鍋忕Щ銆?
 */

import { measureTextWidth, getFontSize } from "./measure";

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const getLineOffsetDelta = (line) =>
  Number.isFinite(line?.__offsetDelta) ? Number(line.__offsetDelta) : 0;

const getLineXForOffset = (line, offset, fallbackFont) => {
  if (!line.runs || line.runs.length === 0) {
    return measureTextWidth(
      fallbackFont,

      line.text.slice(0, Math.max(0, offset - line.start))
    );
  }

  let x = 0;
  const lineOffsetDelta = getLineOffsetDelta(line);

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

const getFontForOffset = (line, offset, fallbackFont) => {
  if (!line.runs || line.runs.length === 0) {
    return fallbackFont;
  }

  const lineOffsetDelta = getLineOffsetDelta(line);
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

const isVisualBlockLine = (line) => {
  if (!line || !Number.isFinite(line.start) || !Number.isFinite(line.end)) {
    return false;
  }
  if (line.end <= line.start) {
    return false;
  }
  return (
    line.imageMeta ||
    line.videoMeta ||
    line.blockType === "image" ||
    line.blockType === "video" ||
    line.blockType === "horizontalRule"
  );
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
      const hit = { pageIndex: p, lineIndex: l, line };
      if (line.start === line.end && clamped === line.start && !emptyHit) {
        emptyHit = hit;
      }

      if (clamped >= line.start && clamped < line.end) {
        if (!rangeHit) {
          rangeHit = hit;
        }
        if (clamped === line.start) {
          if (!startHit) {
            startHit = hit;
          }
          if (isVisualBlockLine(line) && !visualStartHit) {
            visualStartHit = hit;
          }
        }
      }

      if (clamped == line.end && line.end > line.start) {
        if (!lineEndHit) {
          lineEndHit = { pageIndex: p, lineIndex: l, line, isLineEnd: true };
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
  };
}

export function offsetAtX(font, line, x) {
  if (isVisualBlockLine(line)) {
    const width = Math.max(0, Number(line.width) || 0);
    if (width <= 0) {
      return line.start;
    }
    return x < width / 2 ? line.start : line.end;
  }

  if (x <= 0) {
    return line.start;
  }

  if (line.runs && line.runs.length > 0) {
    let acc = 0;
    const lineOffsetDelta = getLineOffsetDelta(line);

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

    return line.end;
  }

  let acc = 0;

  for (let i = 0; i < line.text.length; i += 1) {
    const ch = line.text[i];

    const w = measureTextWidth(font, ch);

    const mid = acc + w / 2;

    if (x < mid) {
      return line.start + i;
    }

    acc += w;
  }

  return line.start + line.text.length;
}

/* 鍏夋爣鐭╁舰锛氭牴鎹亸绉诲畾浣嶅埌琛岋紝鍐嶆寜瀛椾綋澶у皬灞呬腑 */

export function getCaretRect(layout, offset, scrollTop, viewportWidth, textLength, options = null) {
  const info = findLineForOffset(layout, offset, textLength, options);

  if (!info) {
    return null;
  }

  const { pageIndex, line } = info;

  const isLineEnd = info.isLineEnd === true;

  const pageSpan = layout.pageHeight + layout.pageGap;

  const pageTop = pageIndex * pageSpan - scrollTop;

  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);
  const lineHeight = getLineHeight(line, layout);
  if (isVisualBlockLine(line)) {
    const width = Math.max(0, Number(line.width) || 0);
    const caretX = isLineEnd ? width : 0;
    return {
      x: pageX + line.x + caretX,
      y: pageTop + line.y,
      height: lineHeight,
    };
  }

  const localIndex = Math.max(0, Math.min(offset - line.start, line.text.length));
  const localX = getLineXForOffset(line, line.start + localIndex, layout.font);
  const caretX = isLineEnd ? Math.max(localX, line.width || localX) : localX;
  const caretFont = getFontForOffset(line, offset, layout.font);
  const fontSize = getFontSize(caretFont);
  const baselineOffset = getBaselineOffset(lineHeight, fontSize);

  return {
    x: pageX + line.x + caretX,
    y: pageTop + line.y + baselineOffset,
    height: fontSize,
  };
}

const pickLineAtPoint = (lines, x, pageX) => {
  if (lines.length === 0) {
    return null;
  }

  if (lines.length === 1) {
    return lines[0];
  }

  let best = null;

  let bestScore = Number.POSITIVE_INFINITY;

  for (const line of lines) {
    const padding = line.cellPadding || 0;

    const cellWidth = line.cellWidth || line.width || 0;

    const left = pageX + line.x - padding;

    const right = left + cellWidth + padding * 2;

    if (x >= left && x <= right) {
      return line;
    }

    const distance = x < left ? left - x : x - right;

    if (distance < bestScore) {
      bestScore = distance;

      best = line;
    }
  }

  return best || lines[0];
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

  const linesAtY = page.lines.filter((line) => {
    const lineHeight = getLineHeight(line, layout);

    return localY >= line.y && localY < line.y + lineHeight;
  });

  let line = pickLineAtPoint(linesAtY, x, pageX);

  if (!line) {
    line = page.lines.reduce((closest, candidate) => {
      const lineHeight = getLineHeight(candidate, layout);

      const center = candidate.y + lineHeight / 2;

      const delta = Math.abs(center - localY);

      if (!closest || delta < closest.delta) {
        return { line: candidate, delta };
      }

      return closest;
    }, null)?.line;
  }

  if (!line) {
    return null;
  }

  const localX = Math.max(0, x - pageX - line.x);
  let offset = offsetAtX(layout.font, line, localX);
  if (isVisualBlockLine(line)) {
    const lineHeight = getLineHeight(line, layout);
    const localLineY = Math.max(0, y + scrollTop - pageIndex * pageSpan - line.y);
    offset = localLineY < lineHeight / 2 ? line.start : line.end;
  }

  return {
    offset,

    localX,

    pageIndex,

    lineIndex: page.lines.indexOf(line),
    line,
  };
}

