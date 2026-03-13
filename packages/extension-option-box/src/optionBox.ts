import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();

export const serializeOptionBoxToText = (node: any) => {
  const title = normalizeText(node?.attrs?.title);
  return `[Option Box] ${title || "Options"}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeOptionBoxToText(node),
  getTextLength: (node: any) => serializeOptionBoxToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const optionBoxNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    title: { default: "" },
    itemsText: { default: "" },
  },
  parseDOM: [
    {
      tag: "div[data-type=option-box]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        title: dom.getAttribute("data-option-title") || "",
        itemsText: dom.getAttribute("data-option-items") || dom.textContent || "",
      }),
    },
  ],
  toDOM(node) {
    const title = normalizeText(node.attrs?.title) || "Option Box";
    const itemsText = normalizeText(node.attrs?.itemsText);
    const attrs: Record<string, unknown> = {
      "data-type": "option-box",
      "data-option-title": title,
    };
    if (itemsText) attrs["data-option-items"] = itemsText;
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    return ["div", attrs, title];
  },
};
