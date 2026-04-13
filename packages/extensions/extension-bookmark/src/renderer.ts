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
    fragmentOwnerMeta: {
      bookmarkMeta: {
        href: String(attrs.href || ""),
        title,
        description,
      },
    },
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

const drawBookmarkBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  href,
  title,
  description,
  layout,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
  title: string;
  description: string;
  layout: any;
}) => {
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
  ctx.fillText(title, x + 52, y + 28);

  ctx.fillStyle = "#7c2d12";
  ctx.font = "12px Arial";
  ctx.fillText(description || href || "Bookmark", x + 52, y + 48);

  ctx.fillStyle = "#9ca3af";
  ctx.fillText(href || "", x + 52, y + 66);
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

  renderFragment({ ctx, fragment, pageX, pageTop, layout }: any) {
    if (fragment?.type !== "bookmark") {
      return;
    }
    drawBookmarkBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      href: String(fragment?.meta?.bookmarkMeta?.href || ""),
      title: String(fragment?.meta?.bookmarkMeta?.title || "Reference"),
      description: String(fragment?.meta?.bookmarkMeta?.description || ""),
      layout,
    });
  },
};
