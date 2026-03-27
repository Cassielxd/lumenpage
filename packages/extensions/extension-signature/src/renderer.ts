import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 120;
const trimText = (value: unknown) => String(value || "").trim();

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

const buildSignatureLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const desiredWidth = resolvePositiveDimension(attrs.width) ?? Math.min(DEFAULT_WIDTH, maxWidth);
  const desiredHeight = resolvePositiveDimension(attrs.height) ?? DEFAULT_HEIGHT;
  const width = Math.max(1, Math.min(maxWidth, desiredWidth));
  const height = Math.max(1, desiredHeight);
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
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
    blockType: "signature",
    blockAttrs,
    signatureMeta: {
      signer: trimText(attrs.signer) || "Signer",
      signedAt: trimText(attrs.signedAt),
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

export const signatureRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("signature", buildSignatureLayout),
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildSignatureLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "signature",
      blockAttrs: { ...layout.blockAttrs },
    };
  },
  renderLine({ ctx, line, pageX, pageTop }: any) {
    const meta = line.signatureMeta;
    if (!meta) return;
    const x = pageX + line.x;
    const y = pageTop + line.y;
    const width = meta.width;
    const height = meta.height;
    const baselineY = y + Math.max(48, height - 32);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(x, y, width, height);

    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(x + 16, baselineY);
    ctx.lineTo(x + width - 16, baselineY);
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "16px Georgia";
    ctx.fillText(meta.signer, x + 16, Math.max(y + 32, baselineY - 10));

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Arial";
    ctx.fillText(meta.signedAt || "Signature", x + 16, Math.min(y + height - 12, baselineY + 18));
  },
};
