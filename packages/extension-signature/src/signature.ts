import type { NodeSpec } from "lumenpage-model";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();

export const serializeSignatureToText = (node: any) => {
  const signer = normalizeText(node?.attrs?.signer);
  return `[Signature] ${signer || "Signature"}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeSignatureToText(node),
  getTextLength: (node: any) => serializeSignatureToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const signatureNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    signer: { default: "" },
    signedAt: { default: "" },
  },
  parseDOM: [
    {
      tag: "div[data-type=signature]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        signer: dom.getAttribute("data-signature-signer") || dom.textContent || "",
        signedAt: dom.getAttribute("data-signature-date") || "",
      }),
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {
      "data-type": "signature",
      "data-signature-signer": normalizeText(node.attrs?.signer),
      "data-signature-date": normalizeText(node.attrs?.signedAt),
    };
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    return ["div", attrs, normalizeText(node.attrs?.signer) || "Signature"];
  },
};
