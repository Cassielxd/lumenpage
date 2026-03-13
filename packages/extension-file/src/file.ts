import type { NodeSpec } from "lumenpage-model";
import { sanitizeLinkHref } from "lumenpage-link";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();
const sanitizeFileHref = (value: unknown) => sanitizeLinkHref(value) || "";

export const serializeFileToText = (node: any) => {
  const name = normalizeText(node?.attrs?.name);
  const href = sanitizeFileHref(node?.attrs?.href);
  return `[File] ${name || href || "Attachment"}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeFileToText(node),
  getTextLength: (node: any) => serializeFileToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const fileNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    href: { default: "" },
    name: { default: "" },
    size: { default: "" },
    mimeType: { default: "" },
  },
  parseDOM: [
    {
      tag: "a[data-type=file][href]",
      getAttrs: (dom: Element) => {
        const href = sanitizeFileHref(dom.getAttribute("href") || "");
        if (!href) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          href,
          name: dom.getAttribute("data-file-name") || dom.textContent || "",
          size: dom.getAttribute("data-file-size") || "",
          mimeType: dom.getAttribute("data-file-mime") || "",
        };
      },
    },
    {
      tag: "div[data-type=file][data-href]",
      getAttrs: (dom: Element) => {
        const href = sanitizeFileHref(dom.getAttribute("data-href") || "");
        if (!href) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          href,
          name: dom.getAttribute("data-file-name") || dom.textContent || "",
          size: dom.getAttribute("data-file-size") || "",
          mimeType: dom.getAttribute("data-file-mime") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const href = sanitizeFileHref(node.attrs?.href || "");
    const name = normalizeText(node.attrs?.name) || "Attachment";
    const attrs: Record<string, unknown> = {
      "data-type": "file",
      "data-href": href,
      "data-file-name": name,
    };
    if (href) {
      attrs.href = href;
      attrs.target = "_blank";
      attrs.rel = "noopener noreferrer";
      attrs.download = name;
    }
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    if (node.attrs?.size) attrs["data-file-size"] = String(node.attrs.size).trim();
    if (node.attrs?.mimeType) attrs["data-file-mime"] = String(node.attrs.mimeType).trim();
    return ["a", attrs, name];
  },
};
