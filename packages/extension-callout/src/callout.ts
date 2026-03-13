import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();

export const serializeCalloutToText = (node: any) => {
  const title = normalizeText(node?.attrs?.title);
  const text = normalizeText(node?.attrs?.text);
  return `[Callout] ${title || text || "Note"}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeCalloutToText(node),
  getTextLength: (node: any) => serializeCalloutToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const calloutNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    title: { default: "" },
    text: { default: "" },
    tone: { default: "info" },
  },
  parseDOM: [
    {
      tag: "div[data-type=callout]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        title: dom.getAttribute("data-callout-title") || "",
        text: dom.getAttribute("data-callout-text") || dom.textContent || "",
        tone: dom.getAttribute("data-callout-tone") || "info",
      }),
    },
  ],
  toDOM(node) {
    const title = normalizeText(node.attrs?.title) || "Callout";
    const text = normalizeText(node.attrs?.text);
    const attrs: Record<string, unknown> = {
      "data-type": "callout",
      "data-callout-title": title,
      "data-callout-tone": normalizeText(node.attrs?.tone) || "info",
    };
    if (text) attrs["data-callout-text"] = text;
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    return ["div", attrs, `${title}${text ? `: ${text}` : ""}`];
  },
};
