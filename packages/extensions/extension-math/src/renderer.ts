import { breakLines } from "lumenpage-render-engine";

const trimText = (value: unknown) => String(value || "").trim();
const TEXT_LINE_ROLE = "text-line";

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

const buildMathBlockAttrs = ({
  source,
  padding,
  width,
  outerX,
}: {
  source: string;
  padding: number;
  width: number;
  outerX: number;
}) => ({
  source,
  mathPadding: padding,
  width,
  fragmentOwnerMeta: {
    mathMeta: {
      source,
      padding,
      width,
      label: "SUM",
    },
  },
  layoutCapabilities: {
    "visual-block": true,
  },
  visualBounds: {
    x: outerX,
    width,
  },
});

const layoutMathBlock = ({ node, settings }: { node: any; settings: any }) => {
  const source = trimText(node.attrs?.source) || "Formula";
  const font = settings.mathFont || "18px Cambria Math, Times New Roman, serif";
  const padding = 16;
  const outerX = settings.margin.left;
  const width = settings.pageWidth - settings.margin.left - settings.margin.right;
  const maxWidth = width - padding * 2;
  const blockAttrs = buildMathBlockAttrs({
    source,
    padding,
    width,
    outerX,
  });
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
    line.x = outerX + padding;
    line.blockType = "math";
    line.blockAttrs = {
      ...blockAttrs,
      mathLineIndex: index,
      mathLineCount: lines.length,
    };
  });
  return {
    lines,
    length: source.length,
    height: totalHeight,
    blockLineHeight: settings.lineHeight,
    blockType: "math",
    blockAttrs,
  };
};

const cloneMathLines = (lines: any[]) =>
  (lines || []).map((line: any) => ({
    ...line,
    runs: Array.isArray(line?.runs) ? line.runs.map((run: any) => ({ ...run })) : line?.runs,
    blockAttrs: line?.blockAttrs ? { ...line.blockAttrs } : {},
  }));

const isTextLineFragment = (fragment: any) =>
  String(fragment?.role || "") === TEXT_LINE_ROLE || String(fragment?.type || "") === TEXT_LINE_ROLE;

const drawMathChromeSegment = ({
  ctx,
  x,
  y,
  width,
  height,
  isFirst,
  isLast,
  label,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  isFirst: boolean;
  isLast: boolean;
  label: string;
}) => {
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
  ctx.fillText(label, x + 10, y + 20);
};

export const mathRenderer = {
  allowSplit: false,
  lineBodyMode: "default-text" as const,

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

  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "math") {
      return;
    }

    const x = pageX + (Number(fragment?.x) || 0);
    const width = Number(fragment?.width) || 0;
    const label = String(fragment?.meta?.mathMeta?.label || "SUM");
    const childFragments = Array.isArray(fragment?.children)
      ? fragment.children.filter((child: any) => isTextLineFragment(child))
      : [];
    const segments = childFragments.length > 0 ? childFragments : [fragment];

    segments.forEach((segment: any, index: number) => {
      drawMathChromeSegment({
        ctx,
        x,
        y: pageTop + (Number(segment?.y) || 0),
        width,
        height: Number(segment?.height) || 0,
        isFirst: index === 0,
        isLast: index === segments.length - 1,
        label,
      });
    });
  },
};
