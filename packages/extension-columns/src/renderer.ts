const normalizeCount = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(2, Math.min(4, Math.round(count))) : 2;
};
const splitLabels = (value: unknown, count: number) => {
  const labels = String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return Array.from({ length: count }, (_unused, index) => labels[index] || `Column ${index + 1}`);
};
export const columnsRenderer = {
  allowSplit: false,
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const attrs = node.attrs || {};
    const count = normalizeCount(attrs.count);
    const labels = splitLabels(attrs.labels, count);
    const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
    const width = Math.max(1, Math.min(maxWidth, Math.min(620, maxWidth)));
    const height = 112;
    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      lineHeight: height,
      runs: [],
      x: settings.margin.left,
      blockType: "columns",
      blockAttrs: { lineHeight: height, width, height },
      columnsMeta: { count, labels, width, height },
    };
    return { lines: [line], length: 1, height, blockLineHeight: height, blockType: "columns", blockAttrs: { width, height, lineHeight: height } };
  },
  renderLine({ ctx, line, pageX, pageTop }: any) {
    const meta = line.columnsMeta;
    if (!meta) return;
    const x = pageX + line.x;
    const y = pageTop + line.y;
    const gutter = 16;
    const innerWidth = meta.width - gutter * 2;
    const colWidth = innerWidth / meta.count;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, meta.width, meta.height);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(x, y, meta.width, meta.height);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px Arial";
    ctx.fillText(`Columns (${meta.count})`, x + 16, y + 24);
    for (let index = 0; index < meta.count; index += 1) {
      const colX = x + gutter + colWidth * index;
      if (index > 0) {
        ctx.strokeStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.moveTo(colX, y + 36);
        ctx.lineTo(colX, y + meta.height - 12);
        ctx.stroke();
      }
      ctx.fillStyle = "#334155";
      ctx.font = "13px Arial";
      ctx.fillText(meta.labels[index], colX + 10, y + 62);
    }
  },
};
