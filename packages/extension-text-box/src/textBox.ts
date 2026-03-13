import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();

export const serializeTextBoxToText = (node: any) => {
  const text = normalizeText(node?.attrs?.text);
  return `[Text Box] ${text || "Text Box"}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeTextBoxToText(node),
  getTextLength: (node: any) => serializeTextBoxToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const textBoxNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    title: { default: "" },
    text: { default: "" },
  },
  parseDOM: [
    {
      tag: "div[data-type=text-box]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        title: dom.getAttribute("data-text-box-title") || "",
        text: dom.getAttribute("data-text-box-text") || dom.textContent || "",
      }),
    },
  ],
  toDOM(node) {
    const title = normalizeText(node.attrs?.title);
    const text = normalizeText(node.attrs?.text);
    const attrs: Record<string, unknown> = {
      "data-type": "text-box",
      "data-text-box-title": title,
      "data-text-box-text": text,
    };
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    return ["div", attrs, text || title || "Text Box"];
  },
};
