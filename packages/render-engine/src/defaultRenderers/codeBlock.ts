import { breakLines } from "../lineBreaker";
import { textblockToRuns } from "../textRuns";

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

const measureLinesHeight = (lines: any[], fallbackLineHeight: number) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return 0;
  }
  let usedRelativeY = false;
  let maxBottom = 0;
  let cursor = 0;
  for (const line of lines) {
    const lineHeight = Number.isFinite(line?.lineHeight)
      ? line.lineHeight
      : Math.max(1, Number(fallbackLineHeight) || 1);
    if (Number.isFinite(line?.relativeY)) {
      usedRelativeY = true;
      maxBottom = Math.max(maxBottom, line.relativeY + lineHeight);
      continue;
    }
    cursor += lineHeight;
  }
  return usedRelativeY ? maxBottom : cursor;
};

export const codeBlockRenderer = {
  allowSplit: true,
  layoutBlock({ node, settings, registry }: { node: any; settings: any; registry?: any }) {
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
    };
    const runsResult = textblockToRuns(
      node,
      codeSettings,
      "codeBlock",
      node.attrs?.id ?? null,
      blockAttrs,
      0,
      registry
    );
    const maxWidth =
      settings.pageWidth -
      settings.margin.left -
      settings.margin.right -
      metrics.padding * 2;
    const lines = breakLines(
      runsResult.runs || [],
      maxWidth,
      codeSettings.font,
      runsResult.length || 0,
      settings.wrapTolerance || 0,
      settings.minLineWidth || 0,
      settings.measureTextWidth,
      settings.segmentText
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
    return {
      lines,
      length: runsResult.length || 0,
      height: measureLinesHeight(lines, settings.lineHeight),
      blockAttrs,
    };
  },
  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }: any) {
    const background = line.blockAttrs?.codeBlockBackground ?? "#f3f4f6";
    const borderColor = line.blockAttrs?.codeBlockBorderColor ?? "#e5e7eb";
    const width = layout.pageWidth - layout.margin.left - layout.margin.right;
    const x = pageX + layout.margin.left;
    const y = pageTop + line.y;
    const height = line.lineHeight ?? layout.lineHeight;
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
};
