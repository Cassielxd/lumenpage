import { type NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

export const horizontalRuleNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  attrs: {
    id: { default: null },
  },
  parseDOM: [
    {
      tag: "hr",
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
    return ["hr", attrs];
  },
};

export const horizontalRuleRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const width = settings.pageWidth - settings.margin.left - settings.margin.right;
    const height = Math.max(8, Math.round(settings.lineHeight * 0.8));
    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      runs: [],
      x: settings.margin.left,
      blockType: "horizontal_rule",
      blockAttrs: {
        lineHeight: height,
      },
    };

    return {
      lines: [line],
      length: 1,
      height,
      blockLineHeight: height,
      blockAttrs: { lineHeight: height },
    };
  },

  renderLine({ ctx, line, pageX, pageTop, layout }: any) {
    const width = layout.pageWidth - layout.margin.left - layout.margin.right;
    const x = pageX + layout.margin.left;
    const height = line.lineHeight ?? layout.lineHeight;
    const y = pageTop + line.y + height / 2;

    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  },
};
