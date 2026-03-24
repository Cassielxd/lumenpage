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
  const line = {
    text: "",
    start: 0,
    end: 1,
    width,
    lineHeight: height,
    runs: [],
    x: settings.margin.left,
    blockType: "optionBox",
    blockAttrs: { lineHeight: height, width, height },
    optionBoxMeta: {
      title: String(attrs.title || "").trim() || "Options",
      items,
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
  renderLine({ ctx, line, pageX, pageTop }: any) {
    const meta = line.optionBoxMeta;
    if (!meta) return;
    const x = pageX + line.x;
    const y = pageTop + line.y;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, meta.width, meta.height);
    ctx.strokeStyle = "#94a3b8";
    ctx.strokeRect(x, y, meta.width, meta.height);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px Arial";
    ctx.fillText(meta.title, x + 16, y + 24);
    ctx.font = "13px Arial";
    ctx.fillStyle = "#334155";
    meta.items.forEach((item: string, index: number) => {
      const itemY = y + 50 + index * 22;
      ctx.strokeStyle = "#64748b";
      ctx.strokeRect(x + 16, itemY - 10, 12, 12);
      ctx.fillText(item, x + 36, itemY);
    });
  },
};
