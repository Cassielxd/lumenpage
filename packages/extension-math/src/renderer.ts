import { breakLines } from "lumenpage-render-engine";

const trimText = (value: unknown) => String(value || "").trim();

const buildMathRuns = (text: string, font: string) => [
  {
    text,
    styleKey: `math:${font}`,
    font,
    color: "#0f172a",
    underline: false,
    underlineStyle: "solid",
    underlineColor: null,
    strike: false,
    strikeColor: null,
    background: null,
    backgroundRadius: 0,
    backgroundPaddingX: 0,
    shiftY: 0,
    linkHref: null,
    annotationKey: null,
    annotations: null,
    extras: null,
    drawInstructions: null,
    start: 0,
    end: text.length,
    width: 0,
    blockType: "math",
    blockId: null,
    blockAttrs: null,
    blockStart: 0,
  },
];

const layoutMathBlock = ({ node, settings }: { node: any; settings: any }) => {
  const source = trimText(node.attrs?.source) || "Formula";
  const font = settings.mathFont || "18px Cambria Math, Times New Roman, serif";
  const padding = 16;
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right - padding * 2;
  const lines = breakLines(
    buildMathRuns(source, font),
    maxWidth,
    font,
    source.length,
    settings.wrapTolerance || 0,
    settings.minLineWidth || 0,
    settings.measureTextWidth,
    settings.segmentText,
    settings.lineHeight,
  );
  const totalHeight =
    lines.reduce(
      (sum: number, current: any) => sum + (current.lineHeight || settings.lineHeight),
      0,
    ) +
    padding * 2;
  lines.forEach((line: any, index: number) => {
    line.x = settings.margin.left + padding;
    line.blockType = "math";
    line.blockAttrs = {
      source,
      mathPadding: padding,
      mathLineIndex: index,
      mathLineCount: lines.length,
      width: maxWidth + padding * 2,
    };
  });
  return {
    lines,
    length: source.length,
    height: totalHeight,
    blockLineHeight: settings.lineHeight,
    blockType: "math",
    blockAttrs: {
      source,
      mathPadding: padding,
      width: maxWidth + padding * 2,
    },
  };
};

const cloneMathLines = (lines: any[]) =>
  (lines || []).map((line: any) => ({
    ...line,
    runs: Array.isArray(line?.runs) ? line.runs.map((run: any) => ({ ...run })) : line?.runs,
    blockAttrs: line?.blockAttrs ? { ...line.blockAttrs } : {},
  }));

export const mathRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }: { node: any; settings: any }) {
    return layoutMathBlock({ node, settings });
  },

  measureBlock(ctx: any) {
    const { node, settings } = ctx || {};
    const layout = layoutMathBlock({ node, settings });
    const startPos = Number.isFinite(ctx?.startPos ?? ctx?.blockStart)
      ? Number(ctx?.startPos ?? ctx?.blockStart)
      : 0;
    return {
      kind: "math",
      nodeId: node?.attrs?.id ?? null,
      blockId: node?.attrs?.id ?? null,
      startPos,
      endPos: startPos + Math.max(1, Number(layout?.length || 0)),
      width: Number(layout?.blockAttrs?.width || 0),
      height: Number(layout?.height || 0),
      meta: {
        source: "math-modern-measure",
        layoutSnapshot: {
          lines: cloneMathLines(layout?.lines || []),
          length: Math.max(1, Number(layout?.length || 0)),
          height: Number(layout?.height || 0),
          blockAttrs: layout?.blockAttrs ? { ...layout.blockAttrs } : null,
        },
      },
    };
  },

  paginateBlock(ctx: any) {
    const measured = ctx?.measured;
    const snapshot = measured?.meta?.layoutSnapshot || null;
    const cursorPlaced = ctx?.cursor?.localCursor?.placed === true;
    if (!snapshot || cursorPlaced) {
      const endPos = Number(measured?.endPos || measured?.startPos || 0);
      return {
        slice: {
          kind: "math",
          nodeId: measured?.nodeId ?? null,
          blockId: measured?.blockId ?? null,
          startPos: endPos,
          endPos,
          fromPrev: false,
          hasNext: false,
          boxes: [],
          fragments: [],
          lines: [],
          nextCursor: null,
          meta: {
            source: "math-modern-paginate",
            exhausted: true,
          },
        },
        nextCursor: null,
        exhausted: true,
      };
    }

    const availableHeight = Number(ctx?.availableHeight || 0);
    const pageHasLines = ctx?.pageHasLines === true;
    const fits = availableHeight >= Number(snapshot.height || 0);
    if (!fits && pageHasLines) {
      const nextCursor = {
        nodeId: measured?.nodeId ?? null,
        blockId: measured?.blockId ?? null,
        startPos: Number(measured?.startPos || 0),
        endPos: Number(measured?.endPos || measured?.startPos || 0),
        localCursor: { placed: false },
        meta: {
          source: "math-modern-paginate",
          reason: "retry-on-fresh-page",
        },
      };
      return {
        slice: {
          kind: "math",
          nodeId: measured?.nodeId ?? null,
          blockId: measured?.blockId ?? null,
          startPos: Number(measured?.startPos || 0),
          endPos: Number(measured?.startPos || 0),
          fromPrev: false,
          hasNext: true,
          boxes: [],
          fragments: [],
          lines: [],
          nextCursor,
          meta: {
            source: "math-modern-paginate",
            deferred: true,
          },
        },
        nextCursor,
        exhausted: false,
      };
    }

    return {
      slice: {
        kind: "math",
        nodeId: measured?.nodeId ?? null,
        blockId: measured?.blockId ?? null,
        startPos: Number(measured?.startPos || 0),
        endPos: Number(measured?.endPos || measured?.startPos || 0),
        fromPrev: false,
        hasNext: false,
        boxes: [],
        fragments: [],
        lines: cloneMathLines(snapshot.lines),
        nextCursor: null,
        meta: {
          source: "math-modern-paginate",
          placed: true,
        },
      },
      nextCursor: null,
      exhausted: true,
    };
  },

  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }: any) {
    const padding = Number(line.blockAttrs?.mathPadding) || 16;
    const width = Number(line.blockAttrs?.width) || 240;
    const x = pageX + layout.margin.left;
    const y = pageTop + line.y;
    const height = line.lineHeight ?? layout.lineHeight;
    const lineIndex = Number(line.blockAttrs?.mathLineIndex) || 0;
    const lineCount = Number(line.blockAttrs?.mathLineCount) || 1;
    const isFirst = lineIndex === 0;
    const isLast = lineIndex === Math.max(0, lineCount - 1);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    if (isFirst) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y);
    }
    if (isLast) {
      ctx.moveTo(x, y + height);
      ctx.lineTo(x + width, y + height);
    }
    ctx.stroke();

    ctx.fillStyle = "#2563eb";
    ctx.font = "14px Arial";
    ctx.fillText("SUM", x + 10, y + 20);

    if (defaultRender) {
      defaultRender(line, pageX + padding, pageTop, layout);
    }
  },
};
