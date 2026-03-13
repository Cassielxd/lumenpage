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

export const mathRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }: { node: any; settings: any }) {
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
      settings.lineHeight
    );
    const totalHeight =
      lines.reduce(
        (sum: number, current: any) => sum + (current.lineHeight || settings.lineHeight),
        0
      ) + padding * 2;
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
