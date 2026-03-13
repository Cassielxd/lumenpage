import type { NodeSpec } from "lumenpage-model";
import { sanitizeAudioSrc } from "lumenpage-link";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const readPositiveDimensionAttr = (dom: Element | null, name: string) => {
  const raw = dom?.getAttribute?.(name);
  if (raw == null || raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const serializeAudioToText = (node: any) => {
  const title = String(node?.attrs?.title || "").trim();
  return title ? `[Audio] ${title}` : "[Audio]";
};

const leafOffsetMapping = {
  toText: (node: any) => serializeAudioToText(node),
  getTextLength: (node: any) => serializeAudioToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const audioNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    src: { default: "" },
    title: { default: "" },
    width: { default: null },
  },
  parseDOM: [
    {
      tag: "audio[src]",
      getAttrs: (dom: Element) => {
        const src = sanitizeAudioSrc(dom.getAttribute("src") || "");
        if (!src) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          src,
          title: dom.getAttribute("title") || "",
          width: readPositiveDimensionAttr(dom, "width"),
        };
      },
    },
    {
      tag: "div[data-type=audio][data-src]",
      getAttrs: (dom: Element) => {
        const src = sanitizeAudioSrc(dom.getAttribute("data-src") || "");
        if (!src) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          src,
          title: dom.getAttribute("data-title") || "",
          width: readPositiveDimensionAttr(dom, "data-width"),
        };
      },
    },
  ],
  toDOM(node) {
    const attrs: Record<string, unknown> = {};
    const safeSrc = sanitizeAudioSrc(node.attrs?.src || "");
    if (safeSrc) {
      attrs.src = safeSrc;
      attrs["data-src"] = safeSrc;
    }
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    if (node.attrs?.title) {
      attrs.title = node.attrs.title;
      attrs["data-title"] = node.attrs.title;
    }
    if (node.attrs?.width) {
      attrs.width = node.attrs.width;
      attrs["data-width"] = node.attrs.width;
    }
    attrs.controls = true;
    attrs["data-type"] = "audio";
    return ["audio", attrs];
  },
};
