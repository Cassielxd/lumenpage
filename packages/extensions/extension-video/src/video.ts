import type { NodeSpec } from "lumenpage-model";
import { sanitizePosterSrc, sanitizeVideoSrc } from "lumenpage-link";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const readPositiveDimensionAttr = (dom: Element | null, name: string) => {
  const raw = dom?.getAttribute?.(name);
  if (raw == null || raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const serializeVideoToText = () => " ";

const leafOffsetMapping = {
  toText: () => " ",
  getTextLength: () => 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const videoNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    src: { default: "" },
    poster: { default: "" },
    width: { default: null },
    height: { default: null },
    embed: { default: false },
  },
  parseDOM: [
    {
      tag: "video[src]",
      getAttrs: (dom: Element) => {
        const src = sanitizeVideoSrc(dom.getAttribute("src") || "");
        if (!src) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          src,
          poster: sanitizePosterSrc(dom.getAttribute("poster") || ""),
          width: readPositiveDimensionAttr(dom, "width"),
          height: readPositiveDimensionAttr(dom, "height"),
          embed: false,
        };
      },
    },
    {
      tag: "iframe[src]",
      getAttrs: (dom: Element) => {
        const src = sanitizeVideoSrc(dom.getAttribute("src") || "");
        if (!src) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          src,
          width: readPositiveDimensionAttr(dom, "width"),
          height: readPositiveDimensionAttr(dom, "height"),
          embed: true,
        };
      },
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {};
    const safeSrc = sanitizeVideoSrc(node.attrs?.src || "");
    if (safeSrc) attrs.src = safeSrc;
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    if (node.attrs?.width) attrs.width = node.attrs.width;
    if (node.attrs?.height) attrs.height = node.attrs.height;
    const safePoster = sanitizePosterSrc(node.attrs?.poster || "");
    if (safePoster) attrs.poster = safePoster;
    if (node.attrs?.embed) return ["iframe", attrs];
    attrs.controls = true;
    return ["video", attrs];
  },
};
