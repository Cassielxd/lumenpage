import type { NodeSpec } from "lumenpage-model";
import { sanitizeImageSrc } from "lumenpage-link";

const getLineHeight = (line, layout) =>
  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;

const getFontSize = (font) => {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || "");
  if (!match) {
    return 16;
  }
  const size = Number.parseFloat(match[1]);
  return Number.isFinite(size) ? size : 16;
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const readIdAttr = (dom) => dom?.getAttribute?.("data-node-id") || null;

const resolveOverlayHost = (view) =>
  view?.overlayHost ||
  view?._internals?.dom?.overlayHost ||
  view?.dom?.querySelector?.(".lumenpage-overlay-host") ||
  null;

const createImageElement = (node) => {
  const img = document.createElement("img");
  img.src = sanitizeImageSrc(node.attrs?.src || "");
  img.alt = node.attrs?.alt || "";
  img.decoding = "async";
  img.loading = "lazy";
  img.draggable = false;
  img.style.display = "block";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";
  img.style.pointerEvents = "auto";
  return img;
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
          width: dom.getAttribute("width"),
          height: dom.getAttribute("height"),
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

export const imageRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }) {
    const attrs = node.attrs || {};
    const safeSrc = sanitizeImageSrc(attrs.src || "");
    const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
    const desiredWidth = toNumber(attrs.width) || Math.min(320, maxWidth);
    const width = Math.max(1, Math.min(maxWidth, desiredWidth));
    const desiredHeight = toNumber(attrs.height) || Math.round(width * 0.75);
    const height = Math.max(1, desiredHeight);

    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      runs: [],
      x: settings.margin.left,
      blockType: "image",
      blockAttrs: { lineHeight: height, width, height },
      imageMeta: { src: safeSrc, alt: attrs.alt || "", width, height },
    };

    return {
      lines: [line],
      length: 1,
      height,
      blockType: "image",
      blockAttrs: { width, height, lineHeight: height },
    };
  },

  renderLine({ ctx, line, pageX, pageTop, layout }) {
    const meta = line.imageMeta;
    if (!meta) return;

    const x = pageX + line.x;
    const y = pageTop + line.y;
    const width = meta.width;
    const height = meta.height;

    if (ctx.strokeRect) {
      ctx.strokeStyle = "#9ca3af";
      ctx.strokeRect(x, y, width, height);
    }

    if (meta.alt && ctx.fillText) {
      const font = layout.font;
      const fontSize = getFontSize(font);
      const lineHeight = getLineHeight(line, layout);
      const baselineOffset = Math.max(0, (lineHeight - fontSize) / 2);
      ctx.fillStyle = "#6b7280";
      ctx.font = font;
      ctx.fillText(meta.alt, x + 12, y + baselineOffset + 12);
    }
  },

  createNodeView(node, _view, _getPos) {
    const host = resolveOverlayHost(_view);
    if (!host) return null;

    const container = document.createElement("div");
    container.className = "lumenpage-image-overlay";
    container.style.position = "absolute";
    container.style.transform = "translate(0px, 0px)";
    container.style.width = "0";
    container.style.height = "0";
    container.style.pointerEvents = "none";
    container.style.overflow = "visible";
    container.style.background = "#f3f4f6";
    container.style.outline = "none";
    host.appendChild(container);

    const image = createImageElement(node);
    container.appendChild(image);

    let currentNode = node;

    const updateImage = (nextNode) => {
      const src = sanitizeImageSrc(nextNode.attrs?.src || "");
      if (image.src !== src) image.src = src;
      const alt = nextNode.attrs?.alt || "";
      if (image.alt !== alt) image.alt = alt;
    };

    return {
      update(nextNode) {
        if (nextNode.type !== currentNode.type) return false;
        currentNode = nextNode;
        updateImage(nextNode);
        return true;
      },
      syncDOM({ x, y, width, height, visible }) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          container.style.display = "none";
          return;
        }
        container.style.display = visible ? "block" : "none";
        container.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        container.style.width = `${Math.max(1, Math.round(width))}px`;
        container.style.height = `${Math.max(1, Math.round(height))}px`;
      },
      destroy() {
        container.remove();
      },
      selectNode() {
        container.style.outline = "2px solid #3b82f6";
      },
      deselectNode() {
        container.style.outline = "none";
      },
    };
  },
};
