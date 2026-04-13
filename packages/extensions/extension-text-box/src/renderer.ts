import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const trimText = (value: unknown) => String(value || "").trim();

const buildTextBoxLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const width = Math.max(1, Math.min(maxWidth, Math.min(420, maxWidth)));
  const height = 120;
  const title = trimText(attrs.title) || "Text Box";
  const text = trimText(attrs.text) || "Text";
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    fragmentOwnerMeta: {
      textBoxMeta: {
        title,
        text,
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
    blockType: "textBox",
    blockAttrs,
    textBoxMeta: {
      title,
      text,
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

const drawTextBoxBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  title,
  text,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  text: string;
}) => {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#64748b";
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px Arial";
  ctx.fillText(title, x + 16, y + 24);
  ctx.fillStyle = "#475569";
  ctx.font = "13px Arial";
  ctx.fillText(text.slice(0, 120), x + 16, y + 56);
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
  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "textBox") {
      return;
    }
    drawTextBoxBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      title: String(fragment?.meta?.textBoxMeta?.title || "Text Box"),
      text: String(fragment?.meta?.textBoxMeta?.text || "Text"),
    });
  },
};
