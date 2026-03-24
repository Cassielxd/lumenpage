import { getTextStyleKey } from "./mark";

/*
 * 行分割器：根据测量宽度把 runs 断行，输出 line 列表。
 */


// 追加字符段，尽量合并相邻同样式 run。
const appendRunSegment = (
  runs,

  char,

  style,

  styleKey,

  offset,

  width,

  blockType,

  blockId,

  blockAttrs,

  blockStart
) => {
  const last = runs[runs.length - 1];

  if (last && last.styleKey === styleKey) {
    last.text += char;

    last.end += 1;

    last.width += width;

    return;
  }

  runs.push({
    text: char,

    styleKey,

    font: style.font,

    color: style.color,

    underline: style.underline,
    underlineStyle: style.underlineStyle || "solid",
    underlineColor: style.underlineColor || null,

    strike: style.strike,
    strikeColor: style.strikeColor || null,

    background: style.background,
    backgroundRadius: style.backgroundRadius || 0,
    backgroundPaddingX: style.backgroundPaddingX || 0,

    shiftY: style.shiftY || 0,
    linkHref: style.linkHref || null,
    annotationKey: style.annotationKey || null,
    annotations: style.annotations || null,
    extras: style.extras || null,
    drawInstructions: style.drawInstructions || null,

    start: offset,

    end: offset + 1,

    width,

    blockType,

    blockId,

    blockAttrs,

    blockStart,
  });
};

const parseFontSize = (font) => {
  const match = /(\d+(?:\.\d+)?)px/.exec(String(font || ""));
  if (!match) {
    return 16;
  }
  const size = Number.parseFloat(match[1]);
  if (!Number.isFinite(size) || size <= 0) {
    return 16;
  }
  return size;
};

/* ���й������ַ�������������ÿ������� */

// 将 runs 按宽度拆分为行。
export function breakLines(
  runs,

  maxWidth,

  baseFont,

  totalLength,

  wrapTolerance = 0,

  minLineWidth = 0,

  measureTextWidth,

  segmentText,

  baseLineHeight = null
) {
  if (!measureTextWidth) {
    throw new Error("measureTextWidth is required to break lines.");
  }

  const widthCache = new Map();
  const MAX_WIDTH_CACHE = 4000;

  const getWidth = (font, text) => {
    const key = `${font}\n${text}`;
    const cached = widthCache.get(key);
    if (typeof cached === "number") {
      return cached;
    }
    const width = measureTextWidth(font, text);
    widthCache.set(key, width);
    if (widthCache.size > MAX_WIDTH_CACHE) {
      const oldestKey = widthCache.keys().next().value;
      if (oldestKey !== undefined) {
        widthCache.delete(oldestKey);
      }
    }
    return width;
  };

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

  const baseFontSize = parseFontSize(baseFont);
  const normalizedBaseLineHeight =
    Number.isFinite(baseLineHeight) && Number(baseLineHeight) > 0
      ? Number(baseLineHeight)
      : Math.max(1, Math.round(baseFontSize * 1.6));
  const lineHeightScale =
    baseFontSize > 0 ? Math.max(1, normalizedBaseLineHeight / baseFontSize) : 1;
  const fontSizeCache = new Map();
  const getRunFontSize = (fontSpec) => {
    const key = String(fontSpec || baseFont || "");
    const cached = fontSizeCache.get(key);
    if (typeof cached === "number") {
      return cached;
    }
    const size = parseFontSize(key);
    fontSizeCache.set(key, size);
    return size;
  };
  let lineMaxFontSize = baseFontSize;
  let nextLineRelativeY = 0;

  // 固化当前行并重置行状态。
  const pushLine = (endOffset) => {
    const resolvedLineHeight = Math.max(
      normalizedBaseLineHeight,
      Math.round(lineMaxFontSize * lineHeightScale)
    );
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

      lineHeight: resolvedLineHeight,

      relativeY: nextLineRelativeY,
    });

    nextLineRelativeY += resolvedLineHeight;

    lineText = "";

    lineWidth = 0;

    lineRuns = [];

    lineStart = endOffset;

    lineBlockType = null;

    lineBlockId = null;

    lineBlockAttrs = null;

    lineBlockStart = null;

    lineMaxFontSize = baseFontSize;
  };

  // 补齐行级 block 元信息。
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

  // 遍历所有 runs，按宽度累积并断行。
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

    const style = run.style || {
      font: baseFont,
      color: "#111827",
      underline: false,
      strike: false,
      background: null,
      shiftY: 0,
    };
    const styleKey = run.styleKey || getTextStyleKey(style);
    const runFontSize = getRunFontSize(style.font || baseFont);

    let offsetCursor = run.start;

    // 支持自定义分词（如中文分词或 UAX 规则）。
    const segments = typeof segmentText === "function" ? segmentText(run.text) : null;
    const tokens = segments || run.text.match(/\S+|\s+/g) || [];

    // 按字符追加到当前行，必要时强制换行。
    const appendChars = (text, allowWrap) => {
      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        const w = getWidth(style.font || baseFont, ch);
        if (allowWrap && lineWidth + w > limit && lineText.length > 0) {
          pushLine(offsetCursor);
          lineStart = offsetCursor;
        }
        ensureLineMeta(run);
        lineMaxFontSize = Math.max(lineMaxFontSize, runFontSize);
        appendRunSegment(
          lineRuns,
          ch,
          style,
          styleKey,
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
      const tokenWidth = getWidth(style.font || baseFont, tokenText);

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





