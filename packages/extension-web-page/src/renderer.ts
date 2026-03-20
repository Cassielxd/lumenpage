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
  const line = {
    text: "",
    start: 0,
    end: 1,
    width,
    lineHeight: height,
    runs: [],
    x: settings.margin.left,
    blockType: "webPage",
    blockAttrs: { lineHeight: height, width, height },
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
    blockAttrs: { width, height, lineHeight: height },
    length: 1,
  };
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
      blockAttrs: layout.blockAttrs,
    };
  },

  renderLine({ ctx, line, pageX, pageTop }: any) {
    const meta = line.webPageMeta;
    if (!meta) return;

    const x = pageX + line.x;
    const y = pageTop + line.y;
    const width = meta.width;
    const height = meta.height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(x, y, width, 40);
    ctx.fillStyle = "#0f172a";
    ctx.font = "14px Arial";
    ctx.fillText(meta.title, x + 16, y + 24);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Arial";
    ctx.fillText(meta.href || "https://", x + 16, y + 56);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x + 16, y + 72, width - 32, Math.max(80, height - 88));
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(x + 16, y + 72, width - 32, Math.max(80, height - 88));
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Arial";
    ctx.fillText("Web page preview", x + 28, y + 104);
  },
};
