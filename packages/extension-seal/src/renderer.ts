const trimText = (value: unknown) => String(value || "").trim();
export const sealRenderer = {
  allowSplit: false,
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const attrs = node.attrs || {};
    const size = 132;
    const line = {
      text: "",
      start: 0,
      end: 1,
      width: size,
      lineHeight: size,
      runs: [],
      x: settings.margin.left,
      blockType: "seal",
      blockAttrs: { lineHeight: size, width: size, height: size },
      sealMeta: {
        text: trimText(attrs.text) || "APPROVED",
        width: size,
        height: size,
      },
    };
    return { lines: [line], length: 1, height: size, blockLineHeight: size, blockType: "seal", blockAttrs: { width: size, height: size, lineHeight: size } };
  },
  renderLine({ ctx, line, pageX, pageTop }: any) {
    const meta = line.sealMeta;
    if (!meta) return;
    const x = pageX + line.x;
    const y = pageTop + line.y;
    const radius = meta.width / 2 - 8;
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + meta.width / 2, y + meta.height / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.fillText(meta.text.slice(0, 10), x + meta.width / 2, y + meta.height / 2 + 6);
    ctx.textAlign = "start";
    ctx.lineWidth = 1;
  },
};
