import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const normalizeCount = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(2, Math.min(4, Math.round(count))) : 2;
};

const splitLabels = (value: unknown, count: number) => {
  const labels = String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from({ length: count }, (_unused, index) => labels[index] || `Column ${index + 1}`);
};

const buildColumnsLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const count = normalizeCount(attrs.count);
  const labels = splitLabels(attrs.labels, count);
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const width = Math.max(1, Math.min(maxWidth, Math.min(620, maxWidth)));
  const height = 112;
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    fragmentOwnerMeta: {
      columnsMeta: {
        count,
        labels,
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
    blockType: "columns",
    blockAttrs,
    columnsMeta: { count, labels, width, height },
  };
  return {
    width,
    height,
    line,
    blockAttrs,
    length: 1,
  };
};

const drawColumnsBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  count,
  labels,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
  labels: string[];
}) => {
  const gutter = 16;
  const innerWidth = width - gutter * 2;
  const colWidth = innerWidth / Math.max(1, count);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px Arial";
  ctx.fillText(`Columns (${count})`, x + 16, y + 24);
  for (let index = 0; index < count; index += 1) {
    const colX = x + gutter + colWidth * index;
    if (index > 0) {
      ctx.strokeStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(colX, y + 36);
      ctx.lineTo(colX, y + height - 12);
      ctx.stroke();
    }
    ctx.fillStyle = "#334155";
    ctx.font = "13px Arial";
    ctx.fillText(labels[index] || `Column ${index + 1}`, colX + 10, y + 62);
  }
};

export const columnsRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("columns", buildColumnsLayout),
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildColumnsLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "columns",
      blockAttrs: layout.blockAttrs,
    };
  },
  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "columns") {
      return;
    }
    drawColumnsBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      count: Number(fragment?.meta?.columnsMeta?.count) || 2,
      labels: Array.isArray(fragment?.meta?.columnsMeta?.labels) ? fragment.meta.columnsMeta.labels : [],
    });
  },
};
