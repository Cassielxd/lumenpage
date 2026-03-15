
import { hasFragmentOwnerType } from "./fragmentOwners";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

export const horizontalRuleNodeSpec: any = {
  group: "block",
  atom: true,
  selectable: true,
  offsetMapping: {
    toText: () => " ",
    getTextLength: () => 1,
    mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
      offset <= 0 ? nodePos : nodePos + node.nodeSize,
    mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
  },
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
  layoutBlock({ settings }: { node: any; settings: any }) {
    const width = settings.pageWidth - settings.margin.left - settings.margin.right;
    const height = Math.max(8, Math.round(settings.lineHeight * 0.8));
    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      runs: [],
      x: settings.margin.left,
      blockType: "horizontalRule",
      blockAttrs: {
        lineHeight: height,
        layoutCapabilities: {
          "visual-block": true,
        },
        visualBounds: {
          x: settings.margin.left,
          width,
        },
      },
    };
    return {
      lines: [line],
      length: 1,
      height,
      blockLineHeight: height,
      blockAttrs: {
        lineHeight: height,
        layoutCapabilities: {
          "visual-block": true,
        },
        visualBounds: {
          x: settings.margin.left,
          width,
        },
      },
    };
  },
  renderLine({ ctx, line, pageX, pageTop, layout }: any) {
    const width = Math.max(0, Number.isFinite(line?.width) ? Number(line.width) : 0);
    const x = pageX + (Number.isFinite(line?.x) ? Number(line.x) : layout.margin.left);
    const height = line.lineHeight ?? layout.lineHeight;
    const y = pageTop + line.y + height / 2;
    if (hasFragmentOwnerType(line, "horizontalRule", line?.blockId)) {
      return;
    }
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  },
  renderFragment({ ctx, fragment, pageX, pageTop, layout }: any) {
    if (fragment?.type !== "horizontalRule") {
      return;
    }
    const width = Math.max(0, Number(fragment?.width) || 0);
    const x =
      pageX +
      (Number.isFinite(fragment?.x) ? Number(fragment.x) : Number(layout?.margin?.left) || 0);
    const height = Number(fragment?.height) || Number(layout?.lineHeight) || 0;
    const y = pageTop + (Number(fragment?.y) || 0) + height / 2;
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  },
};


