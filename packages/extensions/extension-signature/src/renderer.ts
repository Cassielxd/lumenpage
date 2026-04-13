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
  const signer = trimText(attrs.signer) || "Signer";
  const signedAt = trimText(attrs.signedAt);
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    fragmentOwnerMeta: {
      signatureMeta: {
        signer,
        signedAt,
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
    blockType: "signature",
    blockAttrs,
    signatureMeta: {
      signer,
      signedAt,
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

const drawSignatureBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  signer,
  signedAt,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  signer: string;
  signedAt: string;
}) => {
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
  ctx.fillText(signer, x + 16, Math.max(y + 32, baselineY - 10));

  ctx.fillStyle = "#64748b";
  ctx.font = "12px Arial";
  ctx.fillText(signedAt || "Signature", x + 16, Math.min(y + height - 12, baselineY + 18));
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
  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "signature") {
      return;
    }
    drawSignatureBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      signer: String(fragment?.meta?.signatureMeta?.signer || "Signer"),
      signedAt: String(fragment?.meta?.signatureMeta?.signedAt || ""),
    });
  },
};
