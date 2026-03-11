/*
 * runs 鐢熸垚鍣細灏嗘枃妗?娈佃惤/鏂囨湰杞崲涓哄甫鏍峰紡鐨?runs锛屽苟缁存姢鍏ㄥ眬鍋忕Щ銆?
 */


const styleCache = new Map();

const parseBaseFontSpec = (fontSpec: string) => {
  const value = String(fontSpec || "").trim();
  const match = /(\d+(?:\.\d+)?)px\s+(.+)/.exec(value);
  if (!match) {
    return { size: 16, family: "Arial" };
  }
  const size = Number.parseFloat(match[1]);
  const family = String(match[2] || "").trim();
  return {
    size: Number.isFinite(size) && size > 0 ? size : 16,
    family: family || "Arial",
  };
};

const normalizeCssColor = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const normalizeFontFamily = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }
  return text.replace(/[{};]/g, "").trim() || null;
};

const normalizeFontSize = (value: unknown) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }
  return Math.round(size);
};

// 鏍规嵁 marks 鐢熸垚鏍峰紡骞剁紦瀛樸€?
const buildStyle = (baseFont, marks, settings = null) => {
  let bold = false;

  let italic = false;

  let underline = false;

  let strike = false;

  let code = false;

  let isLink = false;

  let subscript = false;

  let superscript = false;

  let textColor = null;

  let textBackground = null;

  let textFontSize = null;

  let textFontFamily = null;

  if (marks && marks.length) {
    for (const mark of marks) {
      switch (mark.type.name) {
        case "bold":
          bold = true;

          break;

        case "italic":
          italic = true;

          break;

        case "underline":
          underline = true;

          break;

        case "strike":
          strike = true;

          break;

        case "code":
          code = true;

          break;

        case "subscript":
          subscript = true;
          superscript = false;

          break;

        case "superscript":
          superscript = true;
          subscript = false;

          break;

        case "link":
          isLink = true;
          underline = true;

          break;

        case "textStyle":
          if (mark?.attrs) {
            textColor = normalizeCssColor(mark.attrs.color) ?? textColor;
            textBackground = normalizeCssColor(mark.attrs.background) ?? textBackground;
            textFontSize = normalizeFontSize(mark.attrs.fontSize) ?? textFontSize;
            textFontFamily = normalizeFontFamily(mark.attrs.fontFamily) ?? textFontFamily;
          }

          break;

        default:
          break;
      }
    }
  }

  const resolvedBaseFont = code
    ? settings?.codeFont || '13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    : baseFont;
  const parsedBaseFont = parseBaseFontSpec(resolvedBaseFont);

  const prefix = `${italic ? "italic " : ""}${bold ? "bold " : ""}`;

  const scriptScale = subscript || superscript ? 0.72 : 1;

  const fontSize = Math.max(1, Math.round((textFontSize || parsedBaseFont.size) * scriptScale));

  const fontFamily = textFontFamily || parsedBaseFont.family;

  const font = `${prefix}${fontSize}px ${fontFamily}`.trim();

  const shiftY = superscript
    ? -Math.round(fontSize * 0.35)
    : subscript
    ? Math.round(fontSize * 0.2)
    : 0;

  const color = textColor || (isLink ? settings?.linkColor || "#2563eb" : "#111827");

  const background = textBackground || (code ? settings?.codeBackground || "#f3f4f6" : null);

  const key = `${font}|${color}|${underline ? 1 : 0}|${strike ? 1 : 0}|${background ?? ""}|${shiftY}`;

  if (styleCache.has(key)) {
    return styleCache.get(key);
  }

  const style = {
    font,

    color,

    underline,

    strike,

    background,

    shiftY,
  };

  styleCache.set(key, style);

  return style;
};
// 鍚堝苟杩炵画鏂囨湰 run銆?
const appendRun = (runs, run) => {
  const last = runs[runs.length - 1];

  if (last && last.type === "text" && last.styleKey === run.styleKey && last.end === run.start) {
    last.text += run.text;

    last.end = run.end;

    return;
  }

  runs.push(run);
};

// 灏嗗眬閮?run 鍋忕Щ鏄犲皠涓哄叏灞€鍋忕Щ銆?
const applyRunOffset = (runs, offset) => {
  if (!offset) {
    return;
  }

  for (const run of runs) {
    if (run.type === "text") {
      run.start += offset;

      run.end += offset;
    } else if (run.type === "break") {
      run.offset += offset;
    }
  }
};

// 鍐欏叆 block 鍏冧俊鎭€?
const applyBlockMeta = (runs, meta) => {
  if (!meta) {
    return;
  }

  for (const run of runs) {
    if (!run.blockType) {
      run.blockType = meta.blockType;
    }

    if (run.blockId == null) {
      run.blockId = meta.blockId;
    }

    if (!run.blockAttrs) {
      run.blockAttrs = meta.blockAttrs;
    }

    if (run.blockStart == null) {
      run.blockStart = meta.blockStart;
    }
  }
};

// 鏂囨湰鍧楄浆 runs銆?
export function textblockToRuns(
  block,

  settings,

  blockType = "paragraph",

  blockId = null,

  blockAttrs = null,

  blockStart = 0
) {
  const runs = [];

  let offset = 0;

  // 瀛愯妭鐐瑰彲鑳芥槸鏂囨湰鎴?hardBreak銆?
  block.forEach((child) => {
    if (!child.isText) {
      if (child.type?.name === "hardBreak") {
        runs.push({
          type: "break",

          offset,

          blockType,

          blockId,

          blockAttrs,

          blockStart,
        });

        offset += 1;
      }
      return;
    }

    const style = buildStyle(settings.font, child.marks, settings);

    const styleKey = `${style.font}|${style.color}|${style.underline ? 1 : 0}|${style.strike ? 1 : 0}|${style.background ?? ""}|${style.shiftY ?? 0}`;

    const text = child.text || "";

    if (!text) {
      return;
    }

    if (text.includes("\n")) {
      const parts = text.split("\n");
      parts.forEach((part, index) => {
        if (part.length > 0) {
          const run = {
            type: "text",

            text: part,

            start: offset,

            end: offset + part.length,

            style,

            styleKey,

            blockType,

            blockId,

            blockAttrs,

            blockStart,
          };

          appendRun(runs, run);

          offset += part.length;
        }
        if (index < parts.length - 1) {
          runs.push({
            type: "break",

            offset,

            blockType,

            blockId,

            blockAttrs,

            blockStart,
          });
          offset += 1;
        }
      });
      return;
    }

    const run = {
      type: "text",

      text,

      start: offset,

      end: offset + text.length,

      style,

      styleKey,

      blockType,

      blockId,

      blockAttrs,

      blockStart,
    };

    appendRun(runs, run);

    offset += text.length;
  });

  return { runs, length: offset, blockType, blockId, blockAttrs, blockStart };
}

// 鏂囨。杞?runs銆?
export function docToRuns(doc, settings, registry = null) {
  if (doc?.isTextblock) {
    const local = textblockToRuns(doc, settings, doc.type?.name, 0, doc.attrs, 0);

    return { runs: local.runs || [], length: local.length || 0 };
  }

  const runs = [];

  let offset = 0;

  // 鍏佽鑺傜偣鑷畾涔?toRuns锛屽惁鍒欒蛋榛樿鏂囨湰鍧楁祦绋嬨€?
  doc.forEach((block, _pos, index) => {
    let local = null;

    const renderer = registry?.get(block.type.name);

    const blockStart = offset;

    const blockMeta = {
      blockType: block.type.name,

      blockId: block.attrs?.id ?? index,

      blockAttrs: block.attrs || null,

      blockStart,
    };

    if (renderer?.toRuns) {
      local = renderer.toRuns(block, settings);
    } else if (block.isTextblock) {
      local = textblockToRuns(block, settings, block.type.name, block.attrs?.id ?? index, block.attrs, blockStart);
    }

    if (!local) {
      if (block.textContent) {
        local = textToRuns(block.textContent, settings);
      } else {
        return;
      }
    }

    if (local.runs && local.runs.length > 0) {
      applyRunOffset(local.runs, offset);

      applyBlockMeta(local.runs, blockMeta);

      runs.push(...local.runs);
    }

    const localLength = local.length || 0;

    offset += localLength;

    if (index < doc.childCount - 1) {
      const breakRun = {
        type: "break",

        offset,

        blockType: local.blockType || blockMeta.blockType,

        blockId: local.blockId ?? blockMeta.blockId,

        blockAttrs: local.blockAttrs || blockMeta.blockAttrs,

        blockStart: local.blockStart ?? blockMeta.blockStart,
      };

      runs.push(breakRun);

      offset += 1;
    }
  });

  return { runs, length: offset };
}

// 绾枃鏈浆 runs銆?
export function textToRuns(text, settings) {
  const runs = [];

  const style = buildStyle(settings.font, [], settings);

  const styleKey = `${style.font}|${style.color}|${style.underline ? 1 : 0}|${style.strike ? 1 : 0}|${style.background ?? ""}|${style.shiftY ?? 0}`;

  let offset = 0;

  const segments = text.split("\n");

  segments.forEach((segment, index) => {
    if (segment.length > 0) {
      const run = {
        type: "text",

        text: segment,

        start: offset,

        end: offset + segment.length,

        style,

        styleKey,
      };

      runs.push(run);

      offset += segment.length;
    }

    if (index < segments.length - 1) {
      runs.push({ type: "break", offset });

      offset += 1;
    }
  });

  return { runs, length: offset };
}


