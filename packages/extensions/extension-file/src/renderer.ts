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
    fragmentOwnerMeta: {
      fileMeta: {
        href: String(attrs.href || ""),
        name,
        size,
        mimeType,
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

const drawFileBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  name,
  size,
  mimeType,
  href,
  layout,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  size: string;
  mimeType: string;
  href: string;
  layout: any;
}) => {
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
  ctx.fillText(name, x + 60, y + 28);

  ctx.fillStyle = "#64748b";
  ctx.font = "12px Arial";
  ctx.fillText(size || mimeType || href || "File", x + 60, y + 48);
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

  renderFragment({ ctx, fragment, pageX, pageTop, layout }: any) {
    if (fragment?.type !== "file") {
      return;
    }
    drawFileBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      name: String(fragment?.meta?.fileMeta?.name || "Attachment"),
      size: String(fragment?.meta?.fileMeta?.size || ""),
      mimeType: String(fragment?.meta?.fileMeta?.mimeType || ""),
      href: String(fragment?.meta?.fileMeta?.href || ""),
      layout,
    });
  },
};
