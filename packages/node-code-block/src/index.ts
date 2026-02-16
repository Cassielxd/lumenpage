import { type NodeSpec } from "lumenpage-model";
import { breakLines, textblockToRuns } from "lumenpage-view-canvas";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

export const codeBlockNodeSpec: NodeSpec = {
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

export const codeBlockRenderer = {
  layoutBlock({ node, settings }: { node: any; settings: any }) {
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
      "code_block",
      node.attrs?.id ?? null,
      blockAttrs,
      0
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

    for (const line of lines) {
      line.x = settings.margin.left + metrics.padding;
      line.blockType = "code_block";
      line.blockAttrs = { ...(line.blockAttrs || {}), ...blockAttrs };
    }

    return {
      lines,
      length: runsResult.length || 0,
      height: lines.length * settings.lineHeight,
      blockAttrs,
    };
  },

  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }: any) {
    const padding = line.blockAttrs?.codeBlockPadding ?? 12;
    const background = line.blockAttrs?.codeBlockBackground ?? "#f3f4f6";
    const borderColor = line.blockAttrs?.codeBlockBorderColor ?? "#e5e7eb";
    const width = layout.pageWidth - layout.margin.left - layout.margin.right;
    const x = pageX + layout.margin.left;
    const y = pageTop + line.y;
    const height = line.lineHeight ?? layout.lineHeight;

    ctx.fillStyle = background;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(x, y, width, height);

    if (defaultRender) {
      defaultRender(line, pageX, pageTop, layout);
    }
  },
};
