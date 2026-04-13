import { getTextStyleKey, resolveTextStyle } from "./mark.js";

/*
 * Convert text blocks and documents into layout runs.
 */

const appendRun = (runs, run) => {
  const last = runs[runs.length - 1];

  if (last && last.type === "text" && last.styleKey === run.styleKey && last.end === run.start) {
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

const buildStyle = (baseFont, marks, settings = null, registry = null) =>
  resolveTextStyle(
    baseFont,
    marks,
    settings,
    (name) => registry?.getMarkAdapter?.(name),
    (name) => registry?.getMarkAnnotationResolver?.(name)
  );

import { resolveNodeRendererLayoutCapabilities } from "./node.js";

export function textblockToRuns(
  block,
  settings,
  blockType = "paragraph",
  blockId = null,
  blockAttrs = null,
  blockStart = 0,
  registry = null
) {
  const runs = [];
  let offset = 0;

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

    const style = buildStyle(settings.font, child.marks, settings, registry);
    const styleKey = getTextStyleKey(style);
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
            annotations: style.annotations || null,
            annotationKey: style.annotationKey || null,
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
      annotations: style.annotations || null,
      annotationKey: style.annotationKey || null,
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
  if (doc?.isTextblock) {
    const local = textblockToRuns(doc, settings, doc.type?.name, 0, doc.attrs, 0, registry);

    return { runs: local.runs || [], length: local.length || 0 };
  }

  const runs = [];
  let offset = 0;

  doc.forEach((block, _pos, index) => {
    let local = null;

    const renderer = registry?.get(block.type.name);
    const layout = resolveNodeRendererLayoutCapabilities(renderer);
    const blockStart = offset;
    const blockMeta = {
      blockType: block.type.name,
      blockId: block.attrs?.id ?? index,
      blockAttrs: block.attrs || null,
      blockStart,
    };

    if (layout.toRuns) {
      local = layout.toRuns(block, settings, registry);
    } else if (block.isTextblock) {
      local = textblockToRuns(
        block,
        settings,
        block.type.name,
        block.attrs?.id ?? index,
        block.attrs,
        blockStart,
        registry
      );
    }

    if (!local) {
      if (block.textContent) {
        local = textToRuns(block.textContent, settings, registry);
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

export function textToRuns(text, settings, registry = null) {
  const runs = [];
  const style = buildStyle(settings.font, [], settings, registry);
  const styleKey = getTextStyleKey(style);
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
        annotations: style.annotations || null,
        annotationKey: style.annotationKey || null,
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
