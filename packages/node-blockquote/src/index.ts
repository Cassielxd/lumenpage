import { type NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

export const blockquoteNodeSpec: NodeSpec = {
  content: "block+",
  group: "block",
  attrs: {
    id: { default: null },
  },
  parseDOM: [
    {
      tag: "blockquote",
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
    return ["blockquote", attrs, 0];
  },
};

export const blockquoteRenderer = {
  getContainerStyle({ node, settings }: { node: any; settings: any }) {
    return {
      type: node.type.name,
      indent: settings.blockquoteIndent ?? 24,
      borderColor: settings.blockquoteBorderColor ?? "#9ca3af",
      borderWidth: settings.blockquoteBorderWidth ?? 3,
      borderInset: settings.blockquoteBorderInset ?? 4,
    };
  },

  renderContainer({ ctx, line, pageX, pageTop, layout, container }: any) {
    const indent = container?.indent ?? 24;
    const borderColor = container?.borderColor ?? "#9ca3af";
    const borderWidth = container?.borderWidth ?? 3;
    const borderInset = container?.borderInset ?? 4;
    const baseX = Number.isFinite(container?.baseX)
      ? container.baseX
      : layout.margin.left + (container?.offset ?? 0);
    const barX = pageX + baseX + borderInset;
    const barY = pageTop + line.y;
    const barHeight = line.lineHeight ?? layout.lineHeight;

    ctx.fillStyle = borderColor;
    ctx.fillRect(barX, barY, borderWidth, barHeight);
  },
};
