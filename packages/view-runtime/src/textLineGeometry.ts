import { measureTextWidth } from "./measure";
import { isLineVisualBlock } from "./layoutSemantics";

export const getLineHeight = (line: any, layout: any) =>
  Number.isFinite(line?.lineHeight) ? Number(line.lineHeight) : Number(layout?.lineHeight) || 0;

export const getLineOffsetDelta = (line: any) =>
  Number.isFinite(line?.__offsetDelta) ? Number(line.__offsetDelta) : 0;

export const getPageOffsetDelta = (page: any) =>
  Number.isFinite(page?.__pageOffsetDelta) ? Number(page.__pageOffsetDelta) : 0;

export const getRunOffsetDelta = (line: any, page: any = null) =>
  getLineOffsetDelta(line) + getPageOffsetDelta(page);

export const getLineStart = (line: any, page: any = null) =>
  Number.isFinite(line?.start) ? Number(line.start) + getPageOffsetDelta(page) : 0;

export const getLineEnd = (line: any, page: any = null) => {
  const start = getLineStart(line, page);
  return Number.isFinite(line?.end) ? Number(line.end) + getPageOffsetDelta(page) : start;
};

export const getLineBlockStart = (line: any, page: any = null) => {
  if (Number.isFinite(line?.blockStart)) {
    return Number(line.blockStart) + getPageOffsetDelta(page);
  }
  return getLineStart(line, page);
};

export const getLineXForOffset = (
  line: any,
  offset: number,
  fallbackFont: string,
  page: any = null
) => {
  const lineStart = getLineStart(line, page);
  if (!Array.isArray(line?.runs) || line.runs.length === 0) {
    return measureTextWidth(
      fallbackFont,
      String(line?.text || "").slice(0, Math.max(0, offset - lineStart))
    );
  }

  let x = 0;
  const lineOffsetDelta = getRunOffsetDelta(line, page);

  for (const run of line.runs) {
    const runFont = run?.font || fallbackFont;
    const runStart = Number.isFinite(run?.start) ? Number(run.start) + lineOffsetDelta : 0;
    const runEnd = Number.isFinite(run?.end) ? Number(run.end) + lineOffsetDelta : runStart;
    const runText = String(run?.text || "");
    const runWidth =
      typeof run?.width === "number" ? Number(run.width) : measureTextWidth(runFont, runText);

    if (offset <= runStart) {
      return x;
    }

    if (offset >= runEnd) {
      x += runWidth;
      continue;
    }

    x += measureTextWidth(runFont, runText.slice(0, Math.max(0, offset - runStart)));
    return x;
  }

  return x;
};

export const getFontForOffset = (
  line: any,
  offset: number,
  fallbackFont: string,
  page: any = null
) => {
  if (!Array.isArray(line?.runs) || line.runs.length === 0) {
    return fallbackFont;
  }

  const lineOffsetDelta = getRunOffsetDelta(line, page);
  for (const run of line.runs) {
    const runStart = Number.isFinite(run?.start) ? Number(run.start) + lineOffsetDelta : 0;
    const runEnd = Number.isFinite(run?.end) ? Number(run.end) + lineOffsetDelta : runStart;
    if (offset >= runStart && offset <= runEnd) {
      return run?.font || fallbackFont;
    }
  }

  return fallbackFont;
};

export const getBaselineOffset = (lineHeight: number, fontSize: number) =>
  Math.max(0, (lineHeight - fontSize) / 2);

export const isVisualBlockLine = (line: any, page: any = null) => {
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
