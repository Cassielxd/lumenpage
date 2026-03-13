import type { NodeSpec } from "lumenpage-model";
import { sanitizeLinkHref } from "lumenpage-link";

const readIdAttr = (dom: Element | null) => dom?.getAttribute?.("data-node-id") || null;
const normalizeText = (value: unknown) => String(value || "").trim();
const sanitizeBookmarkHref = (value: unknown) => sanitizeLinkHref(value) || "";

export const serializeBookmarkToText = (node: any) => {
  const title = normalizeText(node?.attrs?.title);
  const href = sanitizeBookmarkHref(node?.attrs?.href);
  return `[Bookmark] ${title || href || "Reference"}`;
};

const leafOffsetMapping = {
  toText: (node: any) => serializeBookmarkToText(node),
  getTextLength: (node: any) => serializeBookmarkToText(node).length || 1,
  mapOffsetToPos: (node: any, nodePos: number, offset: number) =>
    offset <= 0 ? nodePos : nodePos + node.nodeSize,
  mapPosToOffset: (_node: any, nodePos: number, pos: number) => (pos <= nodePos ? 0 : 1),
};

export const bookmarkNodeSpec: NodeSpec = {
  group: "block",
  atom: true,
  offsetMapping: leafOffsetMapping,
  attrs: {
    id: { default: null },
    href: { default: "" },
    title: { default: "" },
    description: { default: "" }
  },
  parseDOM: [
    {
      tag: "a[data-type=bookmark][href]",
      getAttrs: (dom: Element) => {
        const href = sanitizeBookmarkHref(dom.getAttribute("href") || "");
        if (!href) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          href,
          title: dom.getAttribute("data-bookmark-title") || dom.textContent || "",
          description: dom.getAttribute("data-bookmark-description") || ""
        };
      }
    },
    {
      tag: "div[data-type=bookmark][data-href]",
      getAttrs: (dom: Element) => {
        const href = sanitizeBookmarkHref(dom.getAttribute("data-href") || "");
        if (!href) {
          return false;
        }
        return {
          id: readIdAttr(dom),
          href,
          title: dom.getAttribute("data-bookmark-title") || dom.textContent || "",
          description: dom.getAttribute("data-bookmark-description") || ""
        };
      }
    }
  ],
  toDOM(node) {
    const href = sanitizeBookmarkHref(node.attrs?.href || "");
    const title = normalizeText(node.attrs?.title) || "Reference";
    const description = normalizeText(node.attrs?.description);
    const attrs: Record<string, unknown> = {
      "data-type": "bookmark",
      "data-href": href,
      "data-bookmark-title": title
    };
    if (href) {
      attrs.href = href;
      attrs.target = "_blank";
      attrs.rel = "noopener noreferrer";
    }
    if (node.attrs?.id) attrs["data-node-id"] = node.attrs.id;
    if (description) attrs["data-bookmark-description"] = description;
    return ["a", attrs, title];
  }
};
