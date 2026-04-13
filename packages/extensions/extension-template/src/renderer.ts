import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const splitItems = (value: unknown) =>
  String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const buildTemplateLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const items = splitItems(attrs.itemsText).slice(0, 3);
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const width = Math.max(1, Math.min(maxWidth, Math.min(560, maxWidth)));
  const height = 132;
  const title = String(attrs.title || "").trim() || "Template";
  const summary = String(attrs.summary || "").trim();
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    fragmentOwnerMeta: {
      templateMeta: {
        title,
        summary,
        items,
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
    blockType: "templateBlock",
    blockAttrs,
    templateMeta: {
      title,
      summary,
      items,
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

const drawTemplateBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  title,
  summary,
  items,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  summary: string;
  items: string[];
}) => {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px Arial";
  ctx.fillText(title, x + 16, y + 24);
  ctx.fillStyle = "#475569";
  ctx.font = "13px Arial";
  ctx.fillText(summary.slice(0, 84), x + 16, y + 48);
  items.forEach((item, index) => {
    ctx.fillStyle = "#334155";
    ctx.fillText(`- ${item}`, x + 16, y + 76 + index * 18);
  });
};

export const templateRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("templateBlock", buildTemplateLayout),
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildTemplateLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "templateBlock",
      blockAttrs: layout.blockAttrs,
    };
  },
  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "templateBlock") {
      return;
    }
    drawTemplateBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      title: String(fragment?.meta?.templateMeta?.title || "Template"),
      summary: String(fragment?.meta?.templateMeta?.summary || ""),
      items: Array.isArray(fragment?.meta?.templateMeta?.items) ? fragment.meta.templateMeta.items : [],
    });
  },
};
