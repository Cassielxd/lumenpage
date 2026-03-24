import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();

export const serializeSealToText = (node: any) => {
  const text = normalizeText(node?.attrs?.text);
  return `[Seal] ${text || "Seal"}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeSealToText(node),
  getTextLength: (node: any) => serializeSealToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const sealNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    text: { default: "" },
  },
  parseDOM: [
    {
      tag: "div[data-type=seal]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        text: dom.getAttribute("data-seal-text") || dom.textContent || "",
      }),
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {
      "data-type": "seal",
      "data-seal-text": normalizeText(node.attrs?.text),
    };
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    return ["div", attrs, normalizeText(node.attrs?.text) || "Seal"];
  },
};
