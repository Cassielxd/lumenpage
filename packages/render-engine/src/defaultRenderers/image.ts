import { hasFragmentOwnerType } from "./fragmentOwners";

const resolvePositiveDimension = (value: unknown) => {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const drawImagePlaceholder = ({ ctx, x, y, width, height, label, font }: any) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return;
  }
  if (ctx.fillRect) {
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(x, y, width, height);
  }

  if (ctx.strokeRect) {
    ctx.strokeStyle = "#9ca3af";
    ctx.strokeRect(x, y, width, height);
  }

  if (ctx.fillText) {
    const match = /(\d+(?:\.\d+)?)px/.exec(font || "");
    const fontSize = match ? Number.parseFloat(match[1]) : 16;
    const baselineOffset = Math.max(0, (height - fontSize) / 2);
    ctx.fillStyle = "#6b7280";
    ctx.font = font;
    ctx.fillText(label || "Image", x + 12, y + baselineOffset + 12);
  }
};

export const imageRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }) {
    const attrs = node.attrs || {};
    const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
    const desiredWidth = resolvePositiveDimension(attrs.width) ?? Math.min(320, maxWidth);
    const width = Math.max(1, Math.min(maxWidth, desiredWidth));
    const desiredHeight = resolvePositiveDimension(attrs.height) ?? Math.round(width * 0.75);
    const height = Math.max(1, desiredHeight);

    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      lineHeight: height,
      runs: [],
      x: settings.margin.left,
      blockType: "image",
      blockAttrs: {
        lineHeight: height,
        width,
        height,
        layoutCapabilities: {
          "visual-block": true,
        },
        fragmentOwnerMeta: {
          alt: attrs.alt || "",
        },
        visualBounds: {
          x: settings.margin.left,
          width,
        },
      },
      imageMeta: { src: String(attrs.src || ""), alt: attrs.alt || "", width, height },
    };

    return {
      lines: [line],
      length: 1,
      height,
      blockLineHeight: height,
      blockType: "image",
      blockAttrs: {
        width,
        height,
        lineHeight: height,
        layoutCapabilities: {
          "visual-block": true,
        },
        fragmentOwnerMeta: {
          alt: attrs.alt || "",
        },
        visualBounds: {
          x: settings.margin.left,
          width,
        },
      },
    };
  },

  renderLine({ ctx, line, pageX, pageTop, layout }) {
    const meta = line.imageMeta;
    if (!meta) return;
    if (hasFragmentOwnerType(line, "image", line?.blockId)) {
      return;
    }

    drawImagePlaceholder({
      ctx,
      x: pageX + line.x,
      y: pageTop + line.y,
      width: meta.width,
      height: meta.height,
      label: meta.alt || "Image",
      font: layout.font,
    });
  },
  renderFragment({ ctx, fragment, pageX, pageTop, layout }) {
    if (fragment?.type !== "image") {
      return;
    }
    drawImagePlaceholder({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      label: fragment?.meta?.alt || "Image",
      font: layout?.font || "16px sans-serif",
    });
  },
};
