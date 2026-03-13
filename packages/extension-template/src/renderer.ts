const splitItems = (value: unknown) =>
  String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

export const templateRenderer = {
  allowSplit: false,
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const attrs = node.attrs || {};
    const items = splitItems(attrs.itemsText).slice(0, 3);
    const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
    const width = Math.max(1, Math.min(maxWidth, Math.min(560, maxWidth)));
    const height = 132;
    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      lineHeight: height,
      runs: [],
      x: settings.margin.left,
      blockType: "templateBlock",
      blockAttrs: { lineHeight: height, width, height },
      templateMeta: {
        title: String(attrs.title || "").trim() || "Template",
        summary: String(attrs.summary || "").trim(),
        items,
        width,
        height,
      },
    };
    return {
      lines: [line],
      length: 1,
      height,
      blockLineHeight: height,
      blockType: "templateBlock",
      blockAttrs: { width, height, lineHeight: height },
    };
  },
  renderLine({ ctx, line, pageX, pageTop }: any) {
    const meta = line.templateMeta;
    if (!meta) return;
    const x = pageX + line.x;
    const y = pageTop + line.y;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, meta.width, meta.height);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(x, y, meta.width, meta.height);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px Arial";
    ctx.fillText(meta.title, x + 16, y + 24);
    ctx.fillStyle = "#475569";
    ctx.font = "13px Arial";
    ctx.fillText(meta.summary.slice(0, 84), x + 16, y + 48);
    meta.items.forEach((item: string, index: number) => {
      ctx.fillStyle = "#334155";
      ctx.fillText(`- ${item}`, x + 16, y + 76 + index * 18);
    });
  },
};
