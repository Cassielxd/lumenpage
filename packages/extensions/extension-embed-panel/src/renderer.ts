import { createUnsplittableBlockPagination } from "lumenpage-render-engine";
import { resolveEmbedPanelDefaultSize } from "./embedPanel.js";

const trimText = (value: unknown) => String(value || "").trim();

const KIND_STYLES: Record<string, { border: string; background: string; accent: string; label: string }> = {
  diagram: { border: "#38bdf8", background: "#f0f9ff", accent: "#0ea5e9", label: "Diagram" },
  echarts: { border: "#f97316", background: "#fff7ed", accent: "#ea580c", label: "ECharts" },
  mermaid: { border: "#8b5cf6", background: "#f5f3ff", accent: "#7c3aed", label: "Mermaid" },
  mindMap: { border: "#10b981", background: "#ecfdf5", accent: "#059669", label: "Mind Map" },
};

const resolveKindStyle = (kind: unknown) => KIND_STYLES[String(kind || "")] || KIND_STYLES.diagram;
const previewSource = (value: unknown) => trimText(value).replace(/\s+/g, " ").slice(0, 160) || "Source";
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

const buildEmbedPanelLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const style = resolveKindStyle(attrs.kind);
  const defaultSize = resolveEmbedPanelDefaultSize(attrs.kind);
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const width = Math.max(
    1,
    Math.min(maxWidth, resolvePositiveDimension(attrs.width) ?? Math.min(defaultSize.width, maxWidth)),
  );
  const height = Math.max(1, resolvePositiveDimension(attrs.height) ?? defaultSize.height);
  const kind = String(attrs.kind || "diagram");
  const title = trimText(attrs.title);
  const source = trimText(attrs.source);
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    fragmentOwnerMeta: {
      embedPanelMeta: {
        kind,
        title,
        source,
        style,
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
    blockType: "embedPanel",
    blockAttrs,
    embedPanelMeta: {
      kind,
      title,
      source,
      width,
      height,
      style,
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

const drawEmbedPanelBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  kind,
  title,
  source,
  style,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: string;
  title: string;
  source: string;
  style: { border: string; background: string; accent: string; label: string };
}) => {
  ctx.fillStyle = style.background;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = style.border;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = style.accent;
  ctx.fillRect(x, y, width, Math.min(36, height));
  ctx.fillStyle = "#ffffff";
  ctx.font = "13px Arial";
  ctx.fillText(style.label, x + 14, y + 23);
  ctx.fillStyle = "#0f172a";
  ctx.font = "14px Arial";
  ctx.fillText(title || style.label, x + 14, y + 58);
  ctx.fillStyle = "#475569";
  ctx.font = "12px Consolas, Courier New, monospace";
  ctx.fillText(previewSource(source), x + 14, y + 84);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px Arial";
  ctx.fillText(
    kind ? "Stored as source, ready for renderer upgrade." : "Stored as source",
    x + 14,
    y + 108,
  );
};

export const embedPanelRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("embedPanel", buildEmbedPanelLayout),
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildEmbedPanelLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "embedPanel",
      blockAttrs: { ...layout.blockAttrs },
    };
  },
  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "embedPanel") {
      return;
    }
    drawEmbedPanelBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      kind: String(fragment?.meta?.embedPanelMeta?.kind || "diagram"),
      title: String(fragment?.meta?.embedPanelMeta?.title || ""),
      source: String(fragment?.meta?.embedPanelMeta?.source || ""),
      style: fragment?.meta?.embedPanelMeta?.style || resolveKindStyle(fragment?.meta?.embedPanelMeta?.kind),
    });
  },
};
