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

export const videoRenderer = {
  allowSplit: false,

  layoutBlock({ node, settings }) {
    const attrs = node.attrs || {};
    const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
    const desiredWidth = resolvePositiveDimension(attrs.width) ?? Math.min(480, maxWidth);
    const width = Math.max(1, Math.min(maxWidth, desiredWidth));
    const desiredHeight = resolvePositiveDimension(attrs.height) ?? Math.round(width * 0.5625);
    const height = Math.max(1, desiredHeight);
    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      lineHeight: height,
      runs: [],
      x: settings.margin.left,
      blockType: "video",
      blockAttrs: { lineHeight: height, width, height },
      videoMeta: { width, height },
    };

    return {
      lines: [line],
      length: 1,
      height,
      blockLineHeight: height,
      blockAttrs: { width, height, lineHeight: height },
    };
  },

  renderLine({ ctx, line, pageX, pageTop }) {
    const width = line.videoMeta?.width ?? line.width ?? 0;
    const height = line.videoMeta?.height ?? line.lineHeight ?? 0;
    if (width <= 0 || height <= 0) return;

    const x = pageX + line.x;
    const y = pageTop + line.y;

    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#9ca3af";
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#6b7280";
    ctx.font = "14px Arial";
    ctx.fillText("Video", x + 12, y + 24);

    ctx.fillStyle = "rgba(107, 114, 128, 0.6)";
    ctx.beginPath();
    ctx.moveTo(x + width / 2 - 12, y + height / 2 - 16);
    ctx.lineTo(x + width / 2 - 12, y + height / 2 + 16);
    ctx.lineTo(x + width / 2 + 16, y + height / 2);
    ctx.closePath();
    ctx.fill();
  },
};
