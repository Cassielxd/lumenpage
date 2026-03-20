import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const trimText = (value: unknown) => String(value || "").trim();

const buildTextBoxLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const width = Math.max(1, Math.min(maxWidth, Math.min(420, maxWidth)));
  const height = 120;
  const line = {
    text: "",
    start: 0,
    end: 1,
    width,
    lineHeight: height,
    runs: [],
    x: settings.margin.left,
    blockType: "textBox",
    blockAttrs: { lineHeight: height, width, height },
    textBoxMeta: {
      title: trimText(attrs.title) || "Text Box",
      text: trimText(attrs.text) || "Text",
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

export const textBoxRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("textBox", buildTextBoxLayout),
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildTextBoxLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "textBox",
      blockAttrs: layout.blockAttrs,
    };
  },
  renderLine({ ctx, line, pageX, pageTop }: any) {
    const meta = line.textBoxMeta;
    if (!meta) return;
    const x = pageX + line.x;
    const y = pageTop + line.y;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, meta.width, meta.height);
    ctx.strokeStyle = "#64748b";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, meta.width, meta.height);
    ctx.setLineDash([]);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px Arial";
    ctx.fillText(meta.title, x + 16, y + 24);
    ctx.fillStyle = "#475569";
    ctx.font = "13px Arial";
    ctx.fillText(meta.text.slice(0, 120), x + 16, y + 56);
  },
};
