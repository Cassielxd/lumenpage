import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();

export const serializeMathToText = (node: any) => {
  const source = normalizeText(node?.attrs?.source);
  return `[Math] ${source || "Formula"}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeMathToText(node),
  getTextLength: (node: any) => serializeMathToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const mathNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    source: { default: "" },
    displayMode: { default: "block" }
  },
  parseDOM: [
    {
      tag: "div[data-type=math]",
      getAttrs: (dom: Element) => {
        const source = normalizeText(dom.getAttribute("data-source") || dom.textContent || "");
        if (!source) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          source,
          displayMode: dom.getAttribute("data-display-mode") || "block"
        };
      }
    },
    {
      tag: "code[data-type=math]",
      getAttrs: (dom: Element) => {
        const source = normalizeText(dom.textContent || "");
        if (!source) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          source,
          displayMode: dom.getAttribute("data-display-mode") || "block"
        };
      }
    }
  ],
  toDOM(node) {
    const source = normalizeText(node.attrs?.source);
    const attrs: Record<string, unknown> = {
      "data-type": "math",
      "data-source": source,
      "data-display-mode": node.attrs?.displayMode || "block"
    };
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    return ["div", attrs, source];
  }
};
