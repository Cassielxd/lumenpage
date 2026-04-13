import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const splitItems = (value: unknown) =>
  String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const buildOptionBoxLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const items = splitItems(attrs.itemsText).slice(0, 4);
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const width = Math.max(1, Math.min(maxWidth, Math.min(520, maxWidth)));
  const height = Math.max(96, 52 + items.length * 22);
  const title = String(attrs.title || "").trim() || "Options";
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    fragmentOwnerMeta: {
      optionBoxMeta: {
        title,
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
    blockType: "optionBox",
    blockAttrs,
    optionBoxMeta: {
      title,
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

const drawOptionBoxBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  title,
  items,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  items: string[];
}) => {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px Arial";
  ctx.fillText(title, x + 16, y + 24);
  ctx.font = "13px Arial";
  ctx.fillStyle = "#334155";
  items.forEach((item, index) => {
    const itemY = y + 50 + index * 22;
    ctx.strokeStyle = "#64748b";
    ctx.strokeRect(x + 16, itemY - 10, 12, 12);
    ctx.fillText(item, x + 36, itemY);
  });
};

export const optionBoxRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("optionBox", buildOptionBoxLayout),
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildOptionBoxLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "optionBox",
      blockAttrs: layout.blockAttrs,
    };
  },
  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "optionBox") {
      return;
    }
    drawOptionBoxBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      title: String(fragment?.meta?.optionBoxMeta?.title || "Options"),
      items: Array.isArray(fragment?.meta?.optionBoxMeta?.items) ? fragment.meta.optionBoxMeta.items : [],
    });
  },
};
