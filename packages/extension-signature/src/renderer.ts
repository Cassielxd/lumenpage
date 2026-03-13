const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 120;
const trimText = (value: unknown) => String(value || "").trim();
const normalizeNumber = (value: unknown, fallback: number) => {
  const numberValue = Number(value);
  if (Number.isFinite(numberValue) && numberValue > 0) {
    return numberValue;
  }
  return fallback;
};

const clampWidth = (value: number, maxWidth: number) => Math.max(1, Math.min(maxWidth, value));

export const signatureRenderer = {
  allowSplit: false,
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const attrs = node.attrs || {};
    const maxWidth = Math.max(0, settings.pageWidth - settings.margin.left - settings.margin.right);
    const width = clampWidth(normalizeNumber(attrs.width, DEFAULT_WIDTH), maxWidth || DEFAULT_WIDTH);
    const height = Math.max(1, normalizeNumber(attrs.height, DEFAULT_HEIGHT));
    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      lineHeight: height,
      runs: [],
      x: settings.margin.left,
      blockType: "signature",
      blockAttrs: { lineHeight: height, width, height },
      signatureMeta: {
        width,
        height,
        signer: trimText(attrs.signer) || "Signer",
        signedAt: trimText(attrs.signedAt) || "",
        strokeWidth: normalizeNumber(attrs.strokeWidth, 2),
        strokeColor: String(attrs.strokeColor || "#0f172a"),
        backgroundColor: String(attrs.backgroundColor || "#ffffff"),
      },
    };
    return {
      lines: [line],
      length: 1,
      height,
      blockLineHeight: height,
      blockType: "signature",
      blockAttrs: { width, height, lineHeight: height },
    };
  },
  renderLine({ ctx, line, pageX, pageTop }: any) {
    const meta = line?.signatureMeta;
    if (!meta) {
      return;
    }
    const x = pageX + (line.x || 0);
    const y = pageTop + (line.y || 0);
    ctx.fillStyle = meta.backgroundColor;
    ctx.fillRect(x, y, meta.width, meta.height);
    ctx.strokeStyle = meta.strokeColor;
    ctx.lineWidth = meta.strokeWidth;
    ctx.strokeRect(x + 0.5, y + 0.5, meta.width - 1, meta.height - 1);
    ctx.fillStyle = "#0f172a";
    ctx.font = "14px Georgia";
    ctx.fillText(meta.signer, x + 12, y + 26);
    if (meta.signedAt) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px Arial";
      ctx.fillText(meta.signedAt, x + 12, y + meta.height - 12);
    }
  },
};
