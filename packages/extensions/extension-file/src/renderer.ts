import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const trimText = (value: unknown) => String(value || "").trim();

const buildFileLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const width = Math.max(1, Math.min(maxWidth, Math.min(460, maxWidth)));
  const height = 72;
  const name = trimText(attrs.name) || "Attachment";
  const size = trimText(attrs.size);
  const mimeType = trimText(attrs.mimeType);
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    layoutCapabilities: {
      "visual-block": true,
    },
    visualBounds: {
      x: settings.margin.left,
      width,
    },
  };
  const line = {
    text: "",
    start: 0,
    end: 1,
    width,
    lineHeight: height,
    runs: [],
    x: settings.margin.left,
    blockType: "file",
    blockAttrs,
    fileMeta: {
      href: String(attrs.href || ""),
      name,
      size,
      mimeType,
      width,
      height,
    },
  };

  return {
    width,
    height,
    line,
    blockAttrs,
    length: 1,
  };
};

export const fileRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("file", buildFileLayout),

  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildFileLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "file",
      blockAttrs: { ...layout.blockAttrs },
    };
  },

  renderLine({ ctx, line, pageX, pageTop, layout }: any) {
    const meta = line.fileMeta;
    if (!meta) return;

    const x = pageX + line.x;
    const y = pageTop + line.y;
    const width = meta.width;
    const height = meta.height;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#2563eb";
    ctx.fillRect(x + 16, y + 18, 28, 36);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 22, y + 24, 16, 4);
    ctx.fillRect(x + 22, y + 31, 12, 4);

    ctx.fillStyle = "#0f172a";
    ctx.font = layout.font;
    ctx.fillText(meta.name, x + 60, y + 28);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Arial";
    ctx.fillText(meta.size || meta.mimeType || meta.href || "File", x + 60, y + 48);
  },
};
