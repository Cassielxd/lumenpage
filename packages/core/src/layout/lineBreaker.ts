/*
 * 文件说明：行内断行器。
 * 主要职责：按可用宽度逐字符断行，生成行列表与 runs。
 */

const appendRunSegment = (
  runs,

  char,

  style,

  offset,

  width,

  blockType,

  blockId,

  blockAttrs,

  blockStart
) => {
  const last = runs[runs.length - 1];

  if (
    last &&
    last.font === style.font &&
    last.color === style.color &&
    last.underline === style.underline
  ) {
    last.text += char;

    last.end += 1;

    last.width += width;

    return;
  }

  runs.push({
    text: char,

    font: style.font,

    color: style.color,

    underline: style.underline,

    start: offset,

    end: offset + 1,

    width,

    blockType,

    blockId,

    blockAttrs,

    blockStart,
  });
};

/* 断行规则：逐字符测宽，超过可用宽度则换行 */

export function breakLines(
  runs,

  maxWidth,

  baseFont,

  totalLength,

  wrapTolerance = 0,

  minLineWidth = 0,

  measureTextWidth
) {
  if (!measureTextWidth) {
    throw new Error("measureTextWidth is required to break lines.");
  }

  const lines = [];

  let lineStart = 0;

  let lineText = "";

  let lineWidth = 0;

  let lineRuns = [];

  let currentBlockType = null;

  let currentBlockId = null;

  let currentBlockAttrs = null;

  let currentBlockStart = null;

  let lineBlockType = null;

  let lineBlockId = null;

  let lineBlockAttrs = null;

  let lineBlockStart = null;

  const pushLine = (endOffset) => {
    lines.push({
      text: lineText,

      start: lineStart,

      end: endOffset,

      width: lineWidth,

      runs: lineRuns,

      blockType: lineBlockType || currentBlockType,

      blockId: lineBlockId ?? currentBlockId,

      blockAttrs: lineBlockAttrs || currentBlockAttrs,

      blockStart: lineBlockStart ?? currentBlockStart,
    });

    lineText = "";

    lineWidth = 0;

    lineRuns = [];

    lineStart = endOffset;

    lineBlockType = null;

    lineBlockId = null;

    lineBlockAttrs = null;

    lineBlockStart = null;
  };

  const ensureLineMeta = (run) => {
    if (!lineBlockType) {
      lineBlockType = run.blockType || currentBlockType;
    }
    if (lineBlockId == null) {
      lineBlockId = run.blockId ?? currentBlockId;
    }
    if (!lineBlockAttrs) {
      lineBlockAttrs = run.blockAttrs || currentBlockAttrs;
    }
    if (lineBlockStart == null) {
      lineBlockStart = run.blockStart ?? currentBlockStart;
    }
  };

  const limit = maxWidth + wrapTolerance;

  for (const run of runs) {
    if (run.blockType) {
      currentBlockType = run.blockType;
    }

    if (run.blockId != null) {
      currentBlockId = run.blockId;
    }

    if (run.blockAttrs) {
      currentBlockAttrs = run.blockAttrs;
    }

    if (run.blockStart != null) {
      currentBlockStart = run.blockStart;
    }

    if (run.type === "break") {
      pushLine(run.offset);

      lineStart = run.offset + 1;

      continue;
    }

    const style = run.style || { font: baseFont, color: "#111827", underline: false };

    let offsetCursor = run.start;

    const tokens = run.text.match(/\S+|\s+/g) || [];

    const appendChars = (text, allowWrap) => {
      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        const w = measureTextWidth(style.font || baseFont, ch);
        if (allowWrap && lineWidth + w > limit && lineText.length > 0) {
          pushLine(offsetCursor);
          lineStart = offsetCursor;
        }
        ensureLineMeta(run);
        appendRunSegment(
          lineRuns,
          ch,
          style,
          offsetCursor,
          w,
          run.blockType,
          run.blockId,
          run.blockAttrs,
          run.blockStart
        );
        lineText += ch;
        lineWidth += w;
        offsetCursor += 1;
      }
    };

    for (const token of tokens) {
      const isWhitespace = token.trim().length === 0;
      const tokenWidth = measureTextWidth(style.font || baseFont, token);

      if (isWhitespace) {
        if (lineText.length === 0) {
          offsetCursor += token.length;
          lineStart = offsetCursor;
          continue;
        }
        if (lineWidth + tokenWidth > limit) {
          pushLine(offsetCursor);
          offsetCursor += token.length;
          lineStart = offsetCursor;
          continue;
        }
        appendChars(token, false);
        continue;
      }

      if (lineWidth + tokenWidth > limit && lineText.length > 0) {
        pushLine(offsetCursor);
        lineStart = offsetCursor;
      }

      if (tokenWidth > limit && lineText.length === 0) {
        appendChars(token, true);
        continue;
      }

      appendChars(token, false);
    }
  }

  if (lineText.length > 0 || lineStart === totalLength) {
    pushLine(totalLength);
  }

  return lines;
}
