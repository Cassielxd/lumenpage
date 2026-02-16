/*
 * 文件说明：行分割器。
 * 主要职责：根据字符宽度与排版宽度，把 runs 断行并计算每行宽度/高度。
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
    last.underline === style.underline &&
    last.strike === style.strike &&
    last.background === style.background
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

    strike: style.strike,

    background: style.background,

    start: offset,

    end: offset + 1,

    width,

    blockType,

    blockId,

    blockAttrs,

    blockStart,
  });
};

/* ���й������ַ�������������ÿ������� */

export function breakLines(
  runs,

  maxWidth,

  baseFont,

  totalLength,

  wrapTolerance = 0,

  minLineWidth = 0,

  measureTextWidth,

  segmentText
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

    const style = run.style || { font: baseFont, color: "#111827", underline: false, strike: false, background: null };

    let offsetCursor = run.start;

    const segments = typeof segmentText === "function" ? segmentText(run.text) : null;
    const tokens = segments || run.text.match(/\S+|\s+/g) || [];

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
      const tokenText = typeof token === "string" ? token : token?.text || "";
      if (!tokenText) {
        continue;
      }
      const isWhitespace =
        typeof token === "string"
          ? tokenText.trim().length === 0
          : token.isWhitespace ?? tokenText.trim().length === 0;
      const tokenWidth = measureTextWidth(style.font || baseFont, tokenText);

      if (isWhitespace) {
        if (lineText.length === 0) {
          offsetCursor += tokenText.length;
          lineStart = offsetCursor;
          continue;
        }
        if (lineWidth + tokenWidth > limit) {
          pushLine(offsetCursor);
          offsetCursor += tokenText.length;
          lineStart = offsetCursor;
          continue;
        }
        appendChars(tokenText, false);
        continue;
      }

      if (lineWidth + tokenWidth > limit && lineText.length > 0) {
        pushLine(offsetCursor);
        lineStart = offsetCursor;
      }

      if (tokenWidth > limit && lineText.length === 0) {
        appendChars(tokenText, true);
        continue;
      }

      appendChars(tokenText, false);
    }
  }

  if (lineText.length > 0 || lineStart === totalLength) {
    pushLine(totalLength);
  }

  return lines;
}





