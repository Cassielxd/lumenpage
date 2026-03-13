const trimText = (value: unknown) => String(value || "").trim();

const TONE_STYLES: Record<string, { border: string; background: string; accent: string; label: string }> = {
  info: { border: "#38bdf8", background: "#f0f9ff", accent: "#0ea5e9", label: "Info" },
  success: { border: "#34d399", background: "#ecfdf5", accent: "#10b981", label: "Success" },
  warning: { border: "#f59e0b", background: "#fffbeb", accent: "#d97706", label: "Warning" },
  danger: { border: "#f87171", background: "#fef2f2", accent: "#ef4444", label: "Danger" },
};

const resolveToneStyle = (tone: unknown) => TONE_STYLES[String(tone || "")] || TONE_STYLES.info;

export const calloutRenderer = {
  allowSplit: false,
  layoutBlock({ node, settings }: { node: any; settings: any }) {
    const attrs = node.attrs || {};
    const style = resolveToneStyle(attrs.tone);
    const maxWidth = settings.pageWidth - settings.margin.left - settings.margin.right;
    const width = Math.max(1, Math.min(maxWidth, Math.min(560, maxWidth)));
    const height = 96;
    const line = {
      text: "",
      start: 0,
      end: 1,
      width,
      lineHeight: height,
      runs: [],
      x: settings.margin.left,
      blockType: "callout",
      blockAttrs: { lineHeight: height, width, height },
      calloutMeta: {
        title: trimText(attrs.title) || "Callout",
        text: trimText(attrs.text) || "Note",
        width,
        height,
        style,
      },
    };
    return {
      lines: [line],
      length: 1,
      height,
      blockLineHeight: height,
      blockType: "callout",
      blockAttrs: { width, height, lineHeight: height },
    };
  },
  renderLine({ ctx, line, pageX, pageTop }: any) {
    const meta = line.calloutMeta;
    if (!meta) return;
    const x = pageX + line.x;
    const y = pageTop + line.y;
    ctx.fillStyle = meta.style.background;
    ctx.fillRect(x, y, meta.width, meta.height);
    ctx.fillStyle = meta.style.accent;
    ctx.fillRect(x, y, 8, meta.height);
    ctx.strokeStyle = meta.style.border;
    ctx.strokeRect(x, y, meta.width, meta.height);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px Arial";
    ctx.fillText(meta.title, x + 24, y + 28);
    ctx.fillStyle = "#475569";
    ctx.font = "13px Arial";
    ctx.fillText(meta.text.slice(0, 96), x + 24, y + 56);
    ctx.fillStyle = meta.style.accent;
    ctx.font = "12px Arial";
    ctx.fillText(meta.style.label, x + 24, y + 80);
  },
};
