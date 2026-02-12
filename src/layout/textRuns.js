const styleCache = new Map();

const buildStyle = (baseFont, marks) => {
  let bold = false;
  let italic = false;
  let underline = false;

  if (marks && marks.length) {
    for (const mark of marks) {
      switch (mark.type.name) {
        case "strong":
          bold = true;
          break;
        case "em":
          italic = true;
          break;
        case "underline":
          underline = true;
          break;
        default:
          break;
      }
    }
  }

  const key = `${baseFont}|${bold ? 1 : 0}|${italic ? 1 : 0}|${underline ? 1 : 0}`;
  if (styleCache.has(key)) {
    return styleCache.get(key);
  }

  const prefix = `${italic ? "italic " : ""}${bold ? "bold " : ""}`;
  const style = {
    font: `${prefix}${baseFont}`.trim(),
    color: "#111827",
    underline,
  };
  styleCache.set(key, style);
  return style;
};

const appendRun = (runs, run) => {
  const last = runs[runs.length - 1];
  if (
    last &&
    last.type === "text" &&
    last.styleKey === run.styleKey &&
    last.end === run.start
  ) {
    last.text += run.text;
    last.end = run.end;
    return;
  }
  runs.push(run);
};

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

  block.forEach((child) => {
    if (!child.isText) {
      return;
    }
    const style = buildStyle(settings.font, child.marks);
    const styleKey = `${style.font}|${style.color}|${style.underline ? 1 : 0}`;
    const text = child.text || "";
    if (!text) {
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

export function docToRuns(doc, settings, registry = null) {
  const runs = [];
  let offset = 0;

  doc.forEach((block, _pos, index) => {
    let local = null;
    const renderer = registry?.get(block.type.name);
    const blockStart = offset;
    const blockMeta = {
      blockType: block.type.name,
      blockId: index,
      blockAttrs: block.attrs || null,
      blockStart,
    };

    if (renderer?.toRuns) {
      local = renderer.toRuns(block, settings);
    } else if (block.isTextblock) {
      local = textblockToRuns(block, settings, block.type.name, index, block.attrs, blockStart);
    }

    if (!local) {
      return;
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

export function textToRuns(text, settings) {
  const runs = [];
  const style = buildStyle(settings.font, []);
  const styleKey = `${style.font}|${style.color}|${style.underline ? 1 : 0}`;
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
