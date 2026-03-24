import type { NodeSpec } from "lumenpage-model";
import { sanitizeLinkHref } from "lumenpage-link";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();

const readPositiveDimensionAttr = (dom: Element | null, name: string) => {
  const raw = dom?.getAttribute?.(name);
  if (raw == null || raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const sanitizeWebPageHref = (value: unknown) => {
  const href = sanitizeLinkHref(value) || "";
  if (!href) {
    return "";
  }
  if (href.startsWith("/") || href.startsWith("./") || href.startsWith("../")) {
    return href;
  }
  return /^https?:\/\//i.test(href) ? href : "";
};

export const serializeWebPageToText = (node: any) => {
  const title = normalizeText(node?.attrs?.title);
  const href = sanitizeWebPageHref(node?.attrs?.href);
  return `[WebPage] ${title || href || "Embedded page"}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeWebPageToText(node),
  getTextLength: (node: any) => serializeWebPageToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const webPageNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    href: { default: "" },
    title: { default: "" },
    width: { default: null },
    height: { default: null }
  },
  parseDOM: [
    {
      tag: "iframe[src]",
      getAttrs: (dom: Element) => {
        const href = sanitizeWebPageHref(dom.getAttribute("src") || "");
        if (!href) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          href,
          title: dom.getAttribute("title") || "",
          width: readPositiveDimensionAttr(dom, "width"),
          height: readPositiveDimensionAttr(dom, "height")
        };
      }
    },
    {
      tag: "div[data-type=web-page][data-href]",
      getAttrs: (dom: Element) => {
        const href = sanitizeWebPageHref(dom.getAttribute("data-href") || "");
        if (!href) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          href,
          title: dom.getAttribute("data-title") || "",
          width: readPositiveDimensionAttr(dom, "data-width"),
          height: readPositiveDimensionAttr(dom, "data-height")
        };
      }
    }
  ],
  toDOM(node) {
    const href = sanitizeWebPageHref(node.attrs?.href || "");
    const attrs: Record<string, unknown> = {
      "data-type": "web-page",
      "data-href": href
    };
    if (href) attrs.src = href;
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    if (node.attrs?.title) {
      attrs.title = node.attrs.title;
      attrs["data-title"] = node.attrs.title;
    }
    if (node.attrs?.width) {
      attrs.width = node.attrs.width;
      attrs["data-width"] = node.attrs.width;
    }
    if (node.attrs?.height) {
      attrs.height = node.attrs.height;
      attrs["data-height"] = node.attrs.height;
    }
    return ["iframe", attrs];
  }
};
