import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();
const normalizeCount = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(2, Math.min(4, Math.round(count))) : 2;
};

export const serializeColumnsToText = (node: any) => `[Columns] ${normalizeCount(node?.attrs?.count)}`;

const leafOffsetMapping = {
  toText: () => " ",
  getTextLength: () => 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const columnsNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    count: { default: 2 },
    labels: { default: "" },
  },
  parseDOM: [
    {
      tag: "div[data-type=columns]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        count: normalizeCount(dom.getAttribute("data-columns-count")),
        labels: dom.getAttribute("data-columns-labels") || "",
      }),
    },
  ],
  toDOM(node) {
    const count = normalizeCount(node.attrs?.count);
    const labels = normalizeText(node.attrs?.labels);
    const attrs: Record<string, unknown> = {
      "data-type": "columns",
      "data-columns-count": count,
    };
    if (labels) attrs["data-columns-labels"] = labels;
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    return ["div", attrs, `Columns ${count}`];
  },
};
