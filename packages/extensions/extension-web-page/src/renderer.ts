import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const trimText = (value: unknown) => String(value || "").trim();

const resolvePositiveDimension = (value: unknown) => {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const buildWebPageLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const desiredWidth = resolvePositiveDimension(attrs.width) ?? Math.min(620, maxWidth);
  const desiredHeight = resolvePositiveDimension(attrs.height) ?? 360;
  const width = Math.max(1, Math.min(maxWidth, desiredWidth));
  const height = Math.max(180, desiredHeight);
  const title = trimText(attrs.title) || "Embedded page";
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    fragmentOwnerMeta: {
      webPageMeta: {
        href: String(attrs.href || ""),
        title,
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
    blockType: "webPage",
    blockAttrs,
    webPageMeta: {
      href: String(attrs.href || ""),
      title,
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

const drawWebPageBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  href,
  title,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
  title: string;
}) => {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(x, y, width, 40);
  ctx.fillStyle = "#0f172a";
  ctx.font = "14px Arial";
  ctx.fillText(title, x + 16, y + 24);

  ctx.fillStyle = "#64748b";
  ctx.font = "12px Arial";
  ctx.fillText(href || "https://", x + 16, y + 56);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x + 16, y + 72, width - 32, Math.max(80, height - 88));
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(x + 16, y + 72, width - 32, Math.max(80, height - 88));
  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px Arial";
  ctx.fillText("Web page preview", x + 28, y + 104);
};

export const webPageRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("webPage", buildWebPageLayout),

  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildWebPageLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "webPage",
      blockAttrs: { ...layout.blockAttrs },
    };
  },

  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "webPage") {
      return;
    }
    drawWebPageBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      href: String(fragment?.meta?.webPageMeta?.href || ""),
      title: String(fragment?.meta?.webPageMeta?.title || "Embedded page"),
    });
  },
};
