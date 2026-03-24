import { breakLines } from "../lineBreaker";
import { textblockToRuns } from "../textRuns";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

const buildParagraphRuns = (node: any, settings: any, registry: any) => {
  const runs = textblockToRuns(
    node,
    settings,
    node.type.name,
    node.attrs?.id ?? null,
    node.attrs,
    0,
    registry,
  );
  return {
    ...runs,
    blockAttrs: {
      ...(runs?.blockAttrs || node.attrs || {}),
      outlineMinWidth: 1,
    },
  };
};

const resolveParagraphLineHeight = (line: any, fallback: number) =>
  Number.isFinite(line?.lineHeight) && Number(line.lineHeight) > 0
    ? Number(line.lineHeight)
    : Math.max(1, Number(fallback) || 1);

const measureParagraphLinesHeight = (lines: any[], fallbackLineHeight: number) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  let maxBottom = 0;
  let cursor = 0;
  let usedRelativeY = false;
  for (const line of lines) {
    const lineHeight = resolveParagraphLineHeight(line, fallbackLineHeight);
    if (Number.isFinite(line?.relativeY)) {
      usedRelativeY = true;
      maxBottom = Math.max(maxBottom, Number(line.relativeY) + lineHeight);
      continue;
    }
    cursor += lineHeight;
  }
  return usedRelativeY ? maxBottom : cursor;
};

const cloneParagraphSliceLines = (lines: any[], startIndex: number, endIndex: number, continuation: any) => {
  const slice = lines.slice(startIndex, endIndex).map((line) => ({
    ...line,
    runs: Array.isArray(line?.runs) ? line.runs.map((run: any) => ({ ...run })) : line?.runs,
    blockAttrs: line?.blockAttrs ? { ...line.blockAttrs } : {},
  }));
  if (slice.length === 0) {
    return slice;
  }
  const baseRelativeY = Number.isFinite(slice[0]?.relativeY) ? Number(slice[0].relativeY) : 0;
  const fragmentIdentity = continuation?.fragmentIdentity ?? null;
  const continuationToken = continuation?.continuationToken ?? null;
  const carryState = continuation?.carryState ?? null;
  slice.forEach((line: any, index: number) => {
    if (Number.isFinite(line?.relativeY)) {
      line.relativeY = Number(line.relativeY) - baseRelativeY;
    }
    line.blockAttrs = {
      ...(line.blockAttrs || {}),
      ...(fragmentIdentity ? { fragmentIdentity } : null),
      ...(continuationToken ? { fragmentContinuationToken: continuationToken } : null),
      ...(carryState ? { fragmentCarryState: carryState } : null),
    };
    if (index === 0 && continuation?.fromPrev === true) {
      line.blockAttrs.sliceFromPrev = true;
    }
    if (index === slice.length - 1 && continuation?.hasNext === true) {
      line.blockAttrs.sliceHasNext = true;
    }
  });
  return slice;
};

const getFittableParagraphLineCount = (lines: any[], availableHeight: number, fallbackLineHeight: number) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  const limit = Number(availableHeight);
  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }
  let consumed = 0;
  let count = 0;
  for (const line of lines) {
    const lineHeight = resolveParagraphLineHeight(line, fallbackLineHeight);
    if (count > 0 && consumed + lineHeight > limit) {
      break;
    }
    if (count === 0 && lineHeight > limit) {
      return 0;
    }
    consumed += lineHeight;
    count += 1;
  }
  return count;
};

export const paragraphNodeSpec: any = {
  content: "inline*",
  group: "block",
  attrs: {
    id: { default: null },
    align: { default: "left" },
    indent: { default: 0 },
    spacingBefore: { default: null },
    spacingAfter: { default: null },
  },
  parseDOM: [
    {
      tag: "p",
      getAttrs: (dom: HTMLElement) => ({
        id: readIdAttr(dom),
        align: dom.style.textAlign || "left",
        indent: Number.parseFloat(dom.style.textIndent || "0") || 0,
        spacingBefore: Number.parseFloat(dom.style.marginTop || "") || null,
        spacingAfter: Number.parseFloat(dom.style.marginBottom || "") || null,
      }),
    },
  ],
  toDOM(node) {
    const styles: string[] = [];
    const { align, indent, id, spacingBefore, spacingAfter } = node.attrs || {};
    if (align && align !== "left") {
      styles.push(`text-align:${align}`);
    }
    if (indent) {
      styles.push(`text-indent:${indent}px`);
    }
    if (Number.isFinite(spacingBefore)) {
      styles.push(`margin-top:${spacingBefore}px`);
    }
    if (Number.isFinite(spacingAfter)) {
      styles.push(`margin-bottom:${spacingAfter}px`);
    }
    const attrs: Record<string, unknown> = styles.length > 0 ? { style: styles.join(";") } : {};
    if (id) {
      attrs["data-node-id"] = id;
    }
    return ["p", attrs, 0];
  },
};

export const paragraphRenderer = {
  allowSplit: true,
  lineBodyMode: "default-text",
  toRuns(node: any, settings: any, registry: any) {
    return buildParagraphRuns(node, settings, registry);
  },
  measureBlock(ctx: any) {
    const { node, settings, registry, measureTextWidth } = ctx || {};
    const runs = buildParagraphRuns(node, settings, registry);
    const maxWidth = Math.max(
      0,
      Number(settings?.pageWidth || 0) - Number(settings?.margin?.left || 0) - Number(settings?.margin?.right || 0),
    );
    const lines = breakLines(
      runs.runs || [],
      maxWidth,
      settings.font,
      runs.length || 0,
      settings.wrapTolerance || 0,
      settings.minLineWidth || 0,
      measureTextWidth || settings.measureTextWidth,
      settings.segmentText,
      runs.blockAttrs?.lineHeight ?? null,
    );
    const lineHeight = Number.isFinite(runs.blockAttrs?.lineHeight)
      ? Number(runs.blockAttrs.lineHeight)
      : Number(settings?.lineHeight || 0);
    const height = measureParagraphLinesHeight(lines, lineHeight);
    const startPos = Number.isFinite(ctx?.startPos ?? ctx?.blockStart)
      ? Number(ctx?.startPos ?? ctx?.blockStart)
      : 0;
    return {
      kind: node?.type?.name || "paragraph",
      nodeId: node?.attrs?.id ?? null,
      blockId: node?.attrs?.id ?? null,
      startPos,
      endPos: startPos + Math.max(0, Number(runs.length || 0)),
      width: maxWidth,
      height,
      breakpoints: lines.map((line: any, index: number) => ({
        kind: "line",
        startPos: startPos + Number(line?.start || 0),
        endPos: startPos + Number(line?.end || line?.start || 0),
        cursor: {
          nodeId: node?.attrs?.id ?? null,
          blockId: node?.attrs?.id ?? null,
          startPos: startPos + Number(line?.start || 0),
          endPos: startPos + Math.max(0, Number(runs.length || 0)),
          localCursor: { lineIndex: index },
        },
      })),
      meta: {
        source: "paragraph-modern-measure",
        lines,
        length: Math.max(0, Number(runs.length || 0)),
        blockAttrs: runs.blockAttrs,
        lineHeight,
      },
    };
  },
  paginateBlock(ctx: any) {
    const measured = ctx?.measured;
    const meta = measured?.meta || {};
    const allLines = Array.isArray(meta?.lines) ? meta.lines : [];
    const lineHeight = Number.isFinite(meta?.lineHeight)
      ? Number(meta.lineHeight)
      : Number(ctx?.lineHeight || 0);
    const startIndex = Number.isFinite(ctx?.cursor?.localCursor?.lineIndex)
      ? Number(ctx.cursor.localCursor.lineIndex)
      : 0;
    const remainingLines = allLines.slice(startIndex);
    if (remainingLines.length === 0) {
      return {
        slice: {
          kind: measured?.kind || "paragraph",
          nodeId: measured?.nodeId ?? null,
          blockId: measured?.blockId ?? null,
          startPos: Number(measured?.endPos || measured?.startPos || 0),
          endPos: Number(measured?.endPos || measured?.startPos || 0),
          fromPrev: startIndex > 0,
          hasNext: false,
          boxes: [],
          fragments: [],
          lines: [],
          nextCursor: null,
          meta: {
            source: "paragraph-modern-paginate",
            exhausted: true,
          },
        },
        nextCursor: null,
        exhausted: true,
      };
    }

    const fittableCount = getFittableParagraphLineCount(
      remainingLines,
      Number(ctx?.availableHeight || 0),
      lineHeight,
    );
    const canForceFirstLine = ctx?.pageHasLines !== true;
    const visibleCount = fittableCount > 0 ? fittableCount : canForceFirstLine ? 1 : 0;
    const endIndex = startIndex + visibleCount;
    const hasNext = endIndex < allLines.length;
    const fragmentIdentity = `paragraph:${measured?.nodeId ?? measured?.startPos ?? 0}`;
    const continuation = {
      fromPrev: startIndex > 0,
      hasNext,
      rowSplit: false,
      fragmentIdentity,
      continuationToken: `${fragmentIdentity}:continuation`,
      carryState: {
        kind: "paragraph",
        lineIndex: startIndex,
      },
    };
    const visibleLines = cloneParagraphSliceLines(allLines, startIndex, endIndex, continuation);
    const visibleHeight = measureParagraphLinesHeight(visibleLines, lineHeight);
    const nextCursor =
      hasNext
        ? {
            nodeId: measured?.nodeId ?? null,
            blockId: measured?.blockId ?? null,
            startPos: Number(measured?.startPos || 0) + Number(allLines[endIndex]?.start || 0),
            endPos: Number(measured?.endPos || measured?.startPos || 0),
            localCursor: { lineIndex: endIndex },
            meta: {
              source: "paragraph-modern-paginate",
            },
          }
        : null;

    return {
      slice: {
        kind: measured?.kind || "paragraph",
        nodeId: measured?.nodeId ?? null,
        blockId: measured?.blockId ?? null,
        startPos: Number(measured?.startPos || 0) + Number(allLines[startIndex]?.start || 0),
        endPos: hasNext
          ? Number(measured?.startPos || 0) + Number(allLines[Math.max(startIndex, endIndex - 1)]?.end || 0)
          : Number(measured?.endPos || measured?.startPos || 0),
        fromPrev: startIndex > 0,
        hasNext,
        boxes: [],
        fragments: [],
        lines: visibleLines,
        nextCursor,
        meta: {
          source: "paragraph-modern-paginate",
          startIndex,
          endIndex,
          visibleHeight,
        },
      },
      nextCursor,
      exhausted: !nextCursor,
    };
  },
  getBlockSpacing({ settings, isTopLevel }: any) {
    if (isTopLevel !== true) {
      return null;
    }
    return {
      before: Number.isFinite(settings?.paragraphSpacingBefore)
        ? Number(settings.paragraphSpacingBefore)
        : undefined,
      after: Number.isFinite(settings?.paragraphSpacingAfter)
        ? Number(settings.paragraphSpacingAfter)
        : undefined,
    };
  },
};
