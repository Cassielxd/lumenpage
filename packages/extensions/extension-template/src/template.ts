import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();

export const serializeTemplateToText = (node: any) => {
  const title = normalizeText(node?.attrs?.title);
  return `[Template] ${title || "Template"}`;
};

const leafOffsetMapping = {
  toText: () => " ",
  getTextLength: () => 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const templateNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    title: { default: "" },
    summary: { default: "" },
    itemsText: { default: "" },
  },
  parseDOM: [
    {
      tag: "div[data-type=template-block]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        title: dom.getAttribute("data-template-title") || "",
        summary: dom.getAttribute("data-template-summary") || "",
        itemsText: dom.getAttribute("data-template-items") || "",
      }),
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {
      "data-type": "template-block",
      "data-template-title": normalizeText(node.attrs?.title),
      "data-template-summary": normalizeText(node.attrs?.summary),
      "data-template-items": normalizeText(node.attrs?.itemsText),
    };
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    return ["div", attrs, normalizeText(node.attrs?.title) || "Template"];
  },
};
