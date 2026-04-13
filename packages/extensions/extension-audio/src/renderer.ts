import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const resolvePositiveDimension = (value: unknown) => {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const buildAudioLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const desiredWidth = resolvePositiveDimension(attrs.width) ?? Math.min(420, maxWidth);
  const width = Math.max(1, Math.min(maxWidth, desiredWidth));
  const height = 72;

  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    fragmentOwnerMeta: {
      audioMeta: {
        src: String(attrs.src || ""),
        title: String(attrs.title || "").trim(),
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
    blockType: "audio",
    blockAttrs,
    audioMeta: {
      src: String(attrs.src || ""),
      title: String(attrs.title || "").trim(),
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

const drawAudioBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  title,
  src,
  layout,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  src: string;
  layout: any;
}) => {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#94a3b8";
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = layout.font;
  ctx.fillText(title || "Audio", x + 48, y + 26);

  ctx.fillStyle = "#64748b";
  ctx.font = "12px Arial";
  ctx.fillText(src || "Audio source", x + 48, y + 46);

  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.arc(x + 24, y + height / 2, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x + 20, y + height / 2 - 8);
  ctx.lineTo(x + 20, y + height / 2 + 8);
  ctx.lineTo(x + 32, y + height / 2);
  ctx.closePath();
  ctx.fill();
};

export const audioRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("audio", buildAudioLayout),

  layoutBlock({ node, settings }) {
    const layout = buildAudioLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "audio",
      blockAttrs: { ...layout.blockAttrs },
    };
  },

  renderFragment({ ctx, fragment, pageX, pageTop, layout }) {
    if (fragment?.type !== "audio") {
      return;
    }
    drawAudioBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      title: String(fragment?.meta?.audioMeta?.title || ""),
      src: String(fragment?.meta?.audioMeta?.src || ""),
      layout,
    });
  },
};
