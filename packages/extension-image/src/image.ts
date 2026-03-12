import type { NodeSpec } from "lumenpage-model";
import { sanitizeImageSrc } from "lumenpage-link";

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;
const readPositiveDimensionAttr = (dom, name) => {
  const raw = dom?.getAttribute?.(name);
  if (raw == null || raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const serializeImageToText = () => " ";

const leafOffsetMapping = {
  toText: () => " ",
  getTextLength: () => 1,
  mapOffsetToPos: (node, nodePos, offset) => (offset <= 0 ? nodePos : nodePos + node.nodeSize),
  mapPosToOffset: (_node, nodePos, pos) => (pos <= nodePos ? 0 : 1),
};

export const imageNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    src: { default: "" },
    alt: { default: "" },
    width: { default: null },
    height: { default: null },
  },
  parseDOM: [
    {
      tag: "img[src]",
      getAttrs: (dom) => {
        const src = sanitizeImageSrc(dom.getAttribute("src") || "");
        if (!src) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          src,
          alt: dom.getAttribute("alt") || "",
          width: readPositiveDimensionAttr(dom, "width"),
          height: readPositiveDimensionAttr(dom, "height"),
        };
      },
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {};
    const safeSrc = sanitizeImageSrc(node.attrs?.src || "");
    if (safeSrc) attrs.src = safeSrc;
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    if (node.attrs?.alt) attrs.alt = node.attrs.alt;
    if (node.attrs?.width) attrs.width = node.attrs.width;
    if (node.attrs?.height) attrs.height = node.attrs.height;
    return ["img", attrs];
  },
};
