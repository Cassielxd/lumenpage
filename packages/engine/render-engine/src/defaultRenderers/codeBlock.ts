import { breakLines } from "../lineBreaker.js";
import { textblockToRuns } from "../textRuns.js";
import { hasFragmentOwnerType } from "./fragmentOwners.js";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

export const codeBlockNodeSpec: any = {
  content: "text*",
  group: "block",
  marks: "",
  code: true,
  attrs: {
    id: { default: null },
  },
  parseDOM: [
    {
      tag: "pre",
      preserveWhitespace: "full",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
      }),
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {};
    if (node.attrs?.id) {
      attrs["data-node-id"] = node.attrs.id;
    }
    return ["pre", attrs, ["code", 0]];
  },
};

const resolveMetrics = (settings: any) => ({
  padding: settings.codeBlockPadding ?? 12,
  background: settings.codeBlockBackground ?? "#f3f4f6",
  borderColor: settings.codeBlockBorderColor ?? "#e5e7eb",
});

const resolveCodeLineHeight = (line: any, fallbackLineHeight: number) => {
  if (Number.isFinite(line?.lineHeight) && Number(line.lineHeight) > 0) {
    return Number(line.lineHeight);
  }
  return Math.max(1, Number(fallbackLineHeight) || 1);
};

const measureLinesHeight = (lines: any[], fallbackLineHeight: number) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  let usedRelativeY = false;
  let maxBottom = 0;
  let cursor = 0;
  for (const line of lines) {
    const lineHeight = resolveCodeLineHeight(line, fallbackLineHeight);
    if (Number.isFinite(line?.relativeY)) {
      usedRelativeY = true;
      maxBottom = Math.max(maxBottom, Number(line.relativeY) + lineHeight);
      continue;
    }
    cursor += lineHeight;
  }
  return usedRelativeY ? maxBottom : cursor;
};

const getFittableCodeLineCount = (lines: any[], availableHeight: number, fallbackLineHeight: number) => {
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
    const lineHeight = resolveCodeLineHeight(line, fallbackLineHeight);
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

const cloneCodeSliceLines = (lines: any[], startIndex: number, endIndex: number, continuation: any) => {
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
      codeBlockLineIndex: startIndex + index,
      codeBlockLineCount: lines.length,
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

const buildCodeBlockLayout = ({ node, settings, registry }: { node: any; settings: any; registry?: any }) => {
  const metrics = resolveMetrics(settings);
  const codeSettings = {
    ...settings,
    font: settings.codeFont || settings.font,
  };
  const blockAttrs = {
    ...(node.attrs || {}),
    codeBlockPadding: metrics.padding,
    codeBlockBackground: metrics.background,
    codeBlockBorderColor: metrics.borderColor,
    codeBlockOuterX: settings.margin.left,
    codeBlockOuterWidth: settings.pageWidth - settings.margin.left - settings.margin.right,
    fragmentOwnerMeta: {
      codeBlockBackground: metrics.background,
      codeBlockBorderColor: metrics.borderColor,
    },
    visualBounds: {
      x: settings.margin.left,
      width: settings.pageWidth - settings.margin.left - settings.margin.right,
    },
  };
  const runsResult = textblockToRuns(
    node,
    codeSettings,
    "codeBlock",
    node.attrs?.id ?? null,
    blockAttrs,
    0,
    registry,
  );
  const maxWidth =
    settings.pageWidth - settings.margin.left - settings.margin.right - metrics.padding * 2;
  const lines = breakLines(
    runsResult.runs || [],
    maxWidth,
    codeSettings.font,
    runsResult.length || 0,
    settings.wrapTolerance || 0,
    settings.minLineWidth || 0,
    settings.measureTextWidth,
    settings.segmentText,
  );
  const totalLines = lines.length;
  lines.forEach((line: any, lineIndex: number) => {
    line.x = settings.margin.left + metrics.padding;
    line.blockType = "codeBlock";
    line.blockAttrs = {
      ...(line.blockAttrs || {}),
      ...blockAttrs,
      codeBlockLineIndex: lineIndex,
      codeBlockLineCount: totalLines,
    };
  });
  const height = measureLinesHeight(lines, settings.lineHeight);
  return {
    metrics,
    codeSettings,
    blockAttrs,
    runsResult,
    lines,
    height,
    maxWidth,
  };
};

const drawCodeBlockChrome = ({ ctx, x, y, width, height, background, borderColor }: any) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return;
  }
  ctx.fillStyle = background;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
};

export const codeBlockRenderer = {
  allowSplit: true,
  lineBodyMode: "default-text",
  layoutBlock({ node, settings, registry }: { node: any; settings: any; registry?: any }) {
    const layout = buildCodeBlockLayout({ node, settings, registry });
    return {
      lines: layout.lines,
      length: layout.runsResult.length || 0,
      height: layout.height,
      blockAttrs: layout.blockAttrs,
    };
  },
  measureBlock(ctx: any) {
    const { node, settings, registry } = ctx || {};
    const layout = buildCodeBlockLayout({ node, settings, registry });
    const startPos = Number.isFinite(ctx?.startPos ?? ctx?.blockStart)
      ? Number(ctx?.startPos ?? ctx?.blockStart)
      : 0;
    return {
      kind: "codeBlock",
      nodeId: node?.attrs?.id ?? null,
      blockId: node?.attrs?.id ?? null,
      startPos,
      endPos: startPos + Math.max(0, Number(layout.runsResult.length || 0)),
      width: Number(layout.blockAttrs?.codeBlockOuterWidth || 0),
      height: layout.height,
      breakpoints: layout.lines.map((line: any, index: number) => ({
        kind: "visual-line",
        startPos: startPos + Number(line?.start || 0),
        endPos: startPos + Number(line?.end || line?.start || 0),
        cursor: {
          nodeId: node?.attrs?.id ?? null,
          blockId: node?.attrs?.id ?? null,
          startPos: startPos + Number(line?.start || 0),
          endPos: startPos + Math.max(0, Number(layout.runsResult.length || 0)),
          localCursor: { lineIndex: index },
        },
      })),
      meta: {
        source: "code-block-modern-measure",
        lines: layout.lines,
        length: Math.max(0, Number(layout.runsResult.length || 0)),
        blockAttrs: layout.blockAttrs,
        lineHeight: settings?.lineHeight,
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
          kind: measured?.kind || "codeBlock",
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
            source: "code-block-modern-paginate",
            exhausted: true,
          },
        },
        nextCursor: null,
        exhausted: true,
      };
    }

    const fittableCount = getFittableCodeLineCount(
      remainingLines,
      Number(ctx?.availableHeight || 0),
      lineHeight,
    );
    const canForceFirstLine = ctx?.pageHasLines !== true;
    const visibleCount = fittableCount > 0 ? fittableCount : canForceFirstLine ? 1 : 0;
    const endIndex = startIndex + visibleCount;
    const hasNext = endIndex < allLines.length;
    const fragmentIdentity = `codeBlock:${measured?.nodeId ?? measured?.startPos ?? 0}`;
    const continuation = {
      fromPrev: startIndex > 0,
      hasNext,
      rowSplit: false,
      fragmentIdentity,
      continuationToken: `${fragmentIdentity}:continuation`,
      carryState: {
        kind: "codeBlock",
        lineIndex: startIndex,
      },
    };
    const visibleLines = cloneCodeSliceLines(allLines, startIndex, endIndex, continuation);
    const visibleHeight = measureLinesHeight(visibleLines, lineHeight);
    const nextCursor =
      hasNext
        ? {
            nodeId: measured?.nodeId ?? null,
            blockId: measured?.blockId ?? null,
            startPos: Number(measured?.startPos || 0) + Number(allLines[endIndex]?.start || 0),
            endPos: Number(measured?.endPos || measured?.startPos || 0),
            localCursor: { lineIndex: endIndex },
            meta: {
              source: "code-block-modern-paginate",
            },
          }
        : null;

    return {
      slice: {
        kind: measured?.kind || "codeBlock",
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
          source: "code-block-modern-paginate",
          startIndex,
          endIndex,
          visibleHeight,
        },
      },
      nextCursor,
      exhausted: !nextCursor,
    };
  },
  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }: any) {
    const background = line.blockAttrs?.codeBlockBackground ?? "#f3f4f6";
    const borderColor = line.blockAttrs?.codeBlockBorderColor ?? "#e5e7eb";
    const width = Math.max(
      0,
      Number.isFinite(line.blockAttrs?.codeBlockOuterWidth)
        ? Number(line.blockAttrs.codeBlockOuterWidth)
        : layout.pageWidth - layout.margin.left - layout.margin.right,
    );
    const x =
      pageX +
      (Number.isFinite(line.blockAttrs?.codeBlockOuterX)
        ? Number(line.blockAttrs.codeBlockOuterX)
        : layout.margin.left);
    const y = pageTop + line.y;
    const height = line.lineHeight ?? layout.lineHeight;
    if (hasFragmentOwnerType(line, "codeBlock", line?.blockId)) {
      if (defaultRender) {
        defaultRender(line, pageX, pageTop, layout);
      }
      return;
    }
    const lineIndex = Number.isFinite(line.blockAttrs?.codeBlockLineIndex)
      ? line.blockAttrs.codeBlockLineIndex
      : 0;
    const lineCount = Number.isFinite(line.blockAttrs?.codeBlockLineCount)
      ? line.blockAttrs.codeBlockLineCount
      : 1;
    const isFirst = lineIndex === 0;
    const isLast = lineIndex === Math.max(0, lineCount - 1);
    const isPageTop = line.y <= layout.margin.top + 0.5;
    ctx.fillStyle = background;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    if (isFirst || isPageTop) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y);
    }
    if (isLast) {
      ctx.moveTo(x, y + height);
      ctx.lineTo(x + width, y + height);
    }
    ctx.stroke();
    if (defaultRender) {
      defaultRender(line, pageX, pageTop, layout);
    }
  },
  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "codeBlock") {
      return;
    }
    drawCodeBlockChrome({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      background: fragment?.meta?.codeBlockBackground ?? "#f3f4f6",
      borderColor: fragment?.meta?.codeBlockBorderColor ?? "#e5e7eb",
    });
  },
};
