import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const trimText = (value: unknown) => String(value || "").trim();

const buildBookmarkLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const width = Math.max(1, Math.min(maxWidth, Math.min(520, maxWidth)));
  const height = 88;
  const title = trimText(attrs.title) || "Reference";
  const description = trimText(attrs.description);
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
    blockType: "bookmark",
    blockAttrs,
    bookmarkMeta: {
      href: String(attrs.href || ""),
      title,
      description,
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

export const bookmarkRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("bookmark", buildBookmarkLayout),

  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildBookmarkLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "bookmark",
      blockAttrs: { ...layout.blockAttrs },
    };
  },

  renderLine({ ctx, line, pageX, pageTop, layout }: any) {
    const meta = line.bookmarkMeta;
    if (!meta) return;

    const x = pageX + line.x;
    const y = pageTop + line.y;
    const width = meta.width;
    const height = meta.height;

    ctx.fillStyle = "#fff7ed";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#fdba74";
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#f97316";
    ctx.fillRect(x + 16, y + 16, 18, 44);
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 60);
    ctx.lineTo(x + 25, y + 52);
    ctx.lineTo(x + 34, y + 60);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#9a3412";
    ctx.font = layout.font;
    ctx.fillText(meta.title, x + 52, y + 28);

    ctx.fillStyle = "#7c2d12";
    ctx.font = "12px Arial";
    ctx.fillText(meta.description || meta.href || "Bookmark", x + 52, y + 48);

    ctx.fillStyle = "#9ca3af";
    ctx.fillText(meta.href || "", x + 52, y + 66);
  },
};
