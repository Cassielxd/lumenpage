const trimText = (value: unknown) => String(value || "").trim();

export const signatureRenderer = {
  allowSplit: false,
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const attrs = node.attrs || {};
    const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
    const width = Math.max(1, Math.min(maxWidth, Math.min(360, maxWidth)));
    const height = 88;
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
        signer: trimText(attrs.signer) || "Signer",
        signedAt: trimText(attrs.signedAt),
        width,
        height,
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
    const meta = line.signatureMeta;
    if (!meta) return;
    const x = pageX + line.x;
    const y = pageTop + line.y;
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 56);
    ctx.lineTo(x + meta.width - 16, y + 56);
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.font = "16px Georgia";
    ctx.fillText(meta.signer, x + 16, y + 46);
    ctx.fillStyle = "#64748b";
    ctx.font = "12px Arial";
    ctx.fillText(meta.signedAt || "Signature", x + 16, y + 74);
  },
};
