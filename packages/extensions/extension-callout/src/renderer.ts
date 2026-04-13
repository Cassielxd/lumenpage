import { createUnsplittableBlockPagination } from "lumenpage-render-engine";

const trimText = (value: unknown) => String(value || "").trim();

const TONE_STYLES: Record<string, { border: string; background: string; accent: string; label: string }> = {
  info: { border: "#38bdf8", background: "#f0f9ff", accent: "#0ea5e9", label: "Info" },
  success: { border: "#34d399", background: "#ecfdf5", accent: "#10b981", label: "Success" },
  warning: { border: "#f59e0b", background: "#fffbeb", accent: "#d97706", label: "Warning" },
  danger: { border: "#f87171", background: "#fef2f2", accent: "#ef4444", label: "Danger" },
};

const resolveToneStyle = (tone: unknown) => TONE_STYLES[String(tone || "")] || TONE_STYLES.info;

const buildCalloutLayout = ({ node, settings }: { node: any; settings: any }) => {
  const attrs = node.attrs || {};
  const style = resolveToneStyle(attrs.tone);
  const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
  const width = Math.max(1, Math.min(maxWidth, Math.min(560, maxWidth)));
  const height = 96;
  const title = trimText(attrs.title) || "Callout";
  const text = trimText(attrs.text) || "Note";
  const blockAttrs = {
    lineHeight: height,
    width,
    height,
    fragmentOwnerMeta: {
      calloutMeta: {
        title,
        text,
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
    blockType: "callout",
    blockAttrs,
    calloutMeta: {
      title,
      text,
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

const drawCalloutBlock = ({
  ctx,
  x,
  y,
  width,
  height,
  title,
  text,
  style,
}: {
  ctx: any;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  text: string;
  style: { border: string; background: string; accent: string; label: string };
}) => {
  ctx.fillStyle = style.background;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = style.accent;
  ctx.fillRect(x, y, 8, height);
  ctx.strokeStyle = style.border;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px Arial";
  ctx.fillText(title, x + 24, y + 28);
  ctx.fillStyle = "#475569";
  ctx.font = "13px Arial";
  ctx.fillText(text.slice(0, 96), x + 24, y + 56);
  ctx.fillStyle = style.accent;
  ctx.font = "12px Arial";
  ctx.fillText(style.label, x + 24, y + 80);
};

export const calloutRenderer = {
  allowSplit: false,
  ...createUnsplittableBlockPagination("callout", buildCalloutLayout),
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const layout = buildCalloutLayout({ node, settings });
    return {
      lines: [layout.line],
      length: layout.length,
      height: layout.height,
      blockLineHeight: layout.height,
      blockType: "callout",
      blockAttrs: layout.blockAttrs,
    };
  },
  renderFragment({ ctx, fragment, pageX, pageTop }: any) {
    if (fragment?.type !== "callout") {
      return;
    }
    drawCalloutBlock({
      ctx,
      x: pageX + (Number(fragment?.x) || 0),
      y: pageTop + (Number(fragment?.y) || 0),
      width: Number(fragment?.width) || 0,
      height: Number(fragment?.height) || 0,
      title: String(fragment?.meta?.calloutMeta?.title || "Callout"),
      text: String(fragment?.meta?.calloutMeta?.text || "Note"),
      style: fragment?.meta?.calloutMeta?.style || resolveToneStyle(null),
    });
  },
};
