import { measureTextWidth, getFontSize } from "./measure.js";

const getLineXForOffset = (line, offset, fallbackFont) => {
  if (!line.runs || line.runs.length === 0) {
    return measureTextWidth(
      fallbackFont,
      line.text.slice(0, Math.max(0, offset - line.start))
    );
  }

  let x = 0;
  for (const run of line.runs) {
    const runFont = run.font || fallbackFont;
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

const getFontForOffset = (line, offset, fallbackFont) => {
  if (!line.runs || line.runs.length === 0) {
    return fallbackFont;
  }

  for (const run of line.runs) {
    if (offset >= run.start && offset <= run.end) {
      return run.font || fallbackFont;
    }
  }

  return fallbackFont;
};

const getBaselineOffset = (lineHeight, fontSize) =>
  Math.max(0, (lineHeight - fontSize) / 2);

export function findLineForOffset(layout, offset, textLength) {
  if (!layout || layout.pages.length === 0) {
    return null;
  }

  const clamped = Math.max(0, Math.min(offset, textLength));

  for (let p = 0; p < layout.pages.length; p += 1) {
    const page = layout.pages[p];
    for (let l = 0; l < page.lines.length; l += 1) {
      const line = page.lines[l];
      if (line.start === line.end && clamped === line.start) {
        return { pageIndex: p, lineIndex: l, line };
      }
      if (clamped >= line.start && clamped < line.end) {
        return { pageIndex: p, lineIndex: l, line };
      }
      if (clamped == line.end && line.end > line.start) {
        return { pageIndex: p, lineIndex: l, line };
      }
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
  if (x <= 0) {
    return line.start;
  }

  if (line.runs && line.runs.length > 0) {
    let acc = 0;
    for (const run of line.runs) {
      const runFont = run.font || font;
      const runWidth =
        typeof run.width === "number"
          ? run.width
          : measureTextWidth(runFont, run.text);

      if (x <= acc + runWidth) {
        let runAcc = 0;
        for (let i = 0; i < run.text.length; i += 1) {
          const ch = run.text[i];
          const w = measureTextWidth(runFont, ch);
          const mid = acc + runAcc + w / 2;
          if (x < mid) {
            return run.start + i;
          }
          runAcc += w;
        }
        return run.start + run.text.length;
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

export function getCaretRect(layout, offset, scrollTop, viewportWidth, textLength) {
  const info = findLineForOffset(layout, offset, textLength);
  if (!info) {
    return null;
  }

  const { pageIndex, line } = info;
  const pageSpan = layout.pageHeight + layout.pageGap;
  const pageTop = pageIndex * pageSpan - scrollTop;
  const pageX = Math.max(0, (viewportWidth - layout.pageWidth) / 2);

  const localIndex = Math.max(0, Math.min(offset - line.start, line.text.length));
  const localX = getLineXForOffset(line, line.start + localIndex, layout.font);
  const caretFont = getFontForOffset(line, offset, layout.font);
  const fontSize = getFontSize(caretFont);
  const baselineOffset = getBaselineOffset(layout.lineHeight, fontSize);

  return {
    x: pageX + line.x + localX,
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

  const linesAtY = page.lines.filter(
    (line) => localY >= line.y && localY < line.y + layout.lineHeight
  );

  let line = pickLineAtPoint(linesAtY, x, pageX);
  if (!line) {
    line = page.lines.reduce((closest, candidate) => {
      const delta = Math.abs(candidate.y - localY);
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
  const offset = offsetAtX(layout.font, line, localX);

  return {
    offset,
    localX,
    pageIndex,
    lineIndex: page.lines.indexOf(line),
  };
}
