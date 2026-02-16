import { type NodeSpec } from "lumenpage-model";

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

export const serializeImageToText = () => " ";

export const imageNodeSpec: NodeSpec = {
  group: "block",

  atom: true,

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

      getAttrs: (dom) => ({
        id: readIdAttr(dom),

        src: dom.getAttribute("src") || "",

        alt: dom.getAttribute("alt") || "",

        width: dom.getAttribute("width"),

        height: dom.getAttribute("height"),
      }),
    },
  ],

  toDOM(node) {
    const attrs: Record<string, unknown> = { src: node.attrs?.src || "" };

    if (node.attrs?.id) {
      attrs["data-node-id"] = node.attrs.id;
    }

    if (node.attrs?.alt) {
      attrs.alt = node.attrs.alt;
    }

    if (node.attrs?.width) {
      attrs.width = node.attrs.width;
    }

    if (node.attrs?.height) {
      attrs.height = node.attrs.height;
    }

    return ["img", attrs];
  },
};

export const imageRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }) {
    const attrs = node.attrs || {};
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
      blockAttrs: {
        lineHeight: height,
        width,
        height,
      },
      imageMeta: {
        src: attrs.src || "",
        alt: attrs.alt || "",
        width,
        height,
      },
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
    if (!meta) {
      return;
    }

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
};
