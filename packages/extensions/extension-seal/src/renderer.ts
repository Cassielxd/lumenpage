import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const trimText = (value: unknown) => String(value || "").trim();

const buildSealLayout = ({ settings, node }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const size = 132;
  const text = trimText(attrs.text) || "APPROVED";
  const blockAttrs = {
    lineHeight: size,
    width: size,
    height: size,
    fragmentOwnerMeta: {
      sealMeta: {
        text,
      },
    },
    layoutCapabilities: {
      "visual-block": true,
    },
    visualBounds: {
      x: settings.margin.left,
      width: size,
    },
  };
  const line = {
    text: "",
    start: 0,
    end: 1,
    width: size,
    lineHeight: size,
    runs: [],
    x: settings.margin.left,
    blockType: "seal",
    blockAttrs,
    sealMeta: {
      text,
      width: size,
      height: size,
    },
  };
  return {
    width: size,
    height: size,
    line,
    blockAttrs,
    length: 1,
  };
};

const drawSealBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  text,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}) => {
  const radius = width / 2 - 8;
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#dc2626";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text.slice(0, 10), x + width / 2, y + height / 2 + 6);
  ctx.textAlign = "start";
  ctx.lineWidth = 1;
};

export const sealRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("seal", buildSealLayout),
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildSealLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "seal",
      blockAttrs: layout.blockAttrs,
    };
  },
  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "seal") {
      return;
    }
    drawSealBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      text: String(fragment?.meta?.sealMeta?.text || "APPROVED"),
    });
  },
};
