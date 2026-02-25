import { type NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;

export const pageBreakNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  offsetMapping: {
    toText: () => "\f",
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
      tag: "div[data-page-break]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
      }),
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {
      "data-page-break": "true",
    };
    if (node.attrs?.id) {
      attrs["data-node-id"] = node.attrs.id;
    }
    return ["div", attrs];
  },
};

