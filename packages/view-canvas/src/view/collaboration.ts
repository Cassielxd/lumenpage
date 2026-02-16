import { Decoration } from "./decorations";

type RemoteSelection = {
  id: string;
  from: number;
  to: number;
  color?: string;
  label?: string;
};

type RemoteSelectionOptions = {
  lineHeight?: number;
  selectionOpacity?: number;
  cursorWidth?: number;
  labelFont?: string;
};

const DEFAULT_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#ea580c"];

const normalizeHex = (hex) => {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length === 3) {
    return normalized
      .split("")
      .map((value) => value + value)
      .join("");
  }
  return normalized.length === 6 ? normalized : null;
};

const withAlpha = (color, alpha) => {
  if (!color) {
    return `rgba(37, 99, 235, ${alpha})`;
  }
  if (color.startsWith("rgba")) {
    return color;
  }
  if (color.startsWith("rgb")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  if (color.startsWith("#")) {
    const normalized = normalizeHex(color);
    if (normalized) {
      const value = parseInt(normalized, 16);
      const r = (value >> 16) & 255;
      const g = (value >> 8) & 255;
      const b = value & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return color;
};

const createCaretRenderer = (color, lineHeight, cursorWidth, label, labelFont) => {
  const caretHeight = Number.isFinite(lineHeight) ? lineHeight : 22;
  const caretWidth = Number.isFinite(cursorWidth) ? cursorWidth : 2;
  const labelText = typeof label === "string" ? label.trim() : "";
  const font = labelFont || "12px Arial";

  return (ctx, x, y) => {
    ctx.fillStyle = color;
    ctx.fillRect(x - caretWidth / 2, y, caretWidth, caretHeight);

    if (!labelText) {
      return;
    }

    ctx.font = font;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    const paddingX = 6;
    const paddingY = 3;
    const metrics = ctx.measureText(labelText);
    const textWidth = metrics.width;
    const textHeight = 12;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = textHeight + paddingY * 2;
    const boxX = x + 6;
    const boxY = Math.max(0, y - boxHeight - 6);

    ctx.fillStyle = withAlpha(color, 0.9);
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(labelText, boxX + paddingX, boxY + paddingY);
  };
};

const resolveSelectionColor = (selection, index) => {
  if (selection?.color) {
    return selection.color;
  }
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
};

export const createRemoteSelectionDecorations = (
  selections: RemoteSelection[] = [],
  options: RemoteSelectionOptions = {}
) => {
  if (!Array.isArray(selections) || selections.length === 0) {
    return [];
  }

  const lineHeight = options.lineHeight ?? 22;
  const selectionOpacity = Number.isFinite(options.selectionOpacity)
    ? options.selectionOpacity
    : 0.25;
  const cursorWidth = options.cursorWidth ?? 2;
  const labelFont = options.labelFont ?? "12px Arial";
  const decorations = [];

  selections.forEach((selection, index) => {
    const from = selection?.from;
    const to = selection?.to;

    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return;
    }

    const start = Math.min(from, to);
    const end = Math.max(from, to);
    const color = resolveSelectionColor(selection, index);

    if (end > start) {
      decorations.push(
        Decoration.inline(start, end, {
          backgroundColor: withAlpha(color, selectionOpacity),
        })
      );
    }

    const render = createCaretRenderer(color, lineHeight, cursorWidth, selection?.label, labelFont);
    decorations.push(Decoration.widget(end, render, { side: 1 }));
  });

  return decorations;
};

export type { RemoteSelection, RemoteSelectionOptions };
