import type { NodeSpec } from "lumenpage-model";

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 120;
const normalizeText = (value: unknown) => String(value || "").trim();
const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const readSignedAt = (dom: Element | null) => dom?.getAttribute?.("data-signature-date") || "";
const readSigner = (dom: Element | null) => dom?.getAttribute?.("data-signature-signer") || dom?.textContent || "";
const readSrc = (dom: Element | null) => dom?.getAttribute?.("data-signature-src") || "";
const readNumberAttr = (dom: Element | null, name: string, fallback: number) => {
  const value = dom?.getAttribute?.(name);
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

export const serializeSignatureToText = (node: any) => {
  const signer = normalizeText(node?.attrs?.signer);
  return `[Signature] ${signer || "Signature"}`;
};

const leafOffsetMapping = {
  toText: () => " ",
  getTextLength: () => 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const signatureNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  selectable: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    signer: { default: "" },
    signedAt: { default: "" },
    src: { default: "" },
    width: { default: DEFAULT_WIDTH },
    height: { default: DEFAULT_HEIGHT },
    strokeWidth: { default: 2 },
    strokeColor: { default: "#0f172a" },
    backgroundColor: { default: "#ffffff" },
  },
  parseDOM: [
    {
      tag: "div[data-type=signature]",
      getAttrs: (dom: Element) => ({
        id: readIdAttr(dom),
        signer: readSigner(dom) || "",
        signedAt: readSignedAt(dom),
        src: readSrc(dom),
        width: readNumberAttr(dom, "data-signature-width", DEFAULT_WIDTH),
        height: readNumberAttr(dom, "data-signature-height", DEFAULT_HEIGHT),
        strokeWidth: readNumberAttr(dom, "data-signature-stroke", 2),
        strokeColor: dom?.getAttribute("data-signature-stroke-color") || "#0f172a",
        backgroundColor: dom?.getAttribute("data-signature-background") || "#ffffff",
      }),
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {
      "data-type": "signature",
      "data-signature-signer": normalizeText(node.attrs?.signer),
      "data-signature-date": normalizeText(node.attrs?.signedAt),
      "data-signature-src": normalizeText(node.attrs?.src),
      "data-signature-width": Number.isFinite(node.attrs?.width) ? node.attrs.width : DEFAULT_WIDTH,
      "data-signature-height": Number.isFinite(node.attrs?.height) ? node.attrs.height : DEFAULT_HEIGHT,
      "data-signature-stroke": Number.isFinite(node.attrs?.strokeWidth) ? node.attrs.strokeWidth : 2,
      "data-signature-stroke-color": node.attrs?.strokeColor || "#0f172a",
      "data-signature-background": node.attrs?.backgroundColor || "#ffffff",
    };
    if (node.attrs?.id) {
      attrs["data-node-id"] = node.attrs.id;
    }
    return ["div", attrs, normalizeText(node.attrs?.signer) || "Signature"];
  },
};
