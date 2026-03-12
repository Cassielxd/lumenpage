export const imageRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }) {
    const attrs = node.attrs || {};
    const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
    const desiredWidth = Number.isFinite(Number(attrs.width)) ? Number(attrs.width) : Math.min(320, maxWidth);
    const width = Math.max(1, Math.min(maxWidth, desiredWidth));
    const desiredHeight = Number.isFinite(Number(attrs.height)) ? Number(attrs.height) : Math.round(width * 0.75);
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
      imageMeta: { src: String(attrs.src || ""), alt: attrs.alt || "", width, height },
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
      const match = /(\d+(?:\.\d+)?)px/.exec(layout.font || "");
      const fontSize = match ? Number.parseFloat(match[1]) : 16;
      const lineHeight = Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;
      const baselineOffset = Math.max(0, (lineHeight - fontSize) / 2);
      ctx.fillStyle = "#6b7280";
      ctx.font = layout.font;
      ctx.fillText(meta.alt, x + 12, y + baselineOffset + 12);
    }
  },
};
