import { drawWavyLine as drawMarkWavyLine } from "lumenpage-render-engine";
import { type DecorationDrawData } from "./decorations";

const resolveSelectionStyle = (settings: any) => {
  const style = settings?.selectionStyle || {};
  const resolveColor = (value: any, fallback: string) => {
    if (value === null || value === false || value === "none" || value === "transparent") {
      return null;
    }
    return value ?? fallback;
  };
  return {
    fill: resolveColor(style.fill, "rgba(191, 219, 254, 0.4)"),
    stroke: resolveColor(style.stroke, "rgba(59, 130, 246, 0.8)"),
    strokeWidth: Number.isFinite(style.strokeWidth) ? style.strokeWidth : 1,
    radius: Number.isFinite(style.radius) ? style.radius : 2,
    inset: Number.isFinite(style.inset) ? style.inset : 0,
  };
};

const drawSelectionRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const clampedRadius = Math.min(Math.max(radius, 0), width / 2, height / 2);
  if (clampedRadius > 0 && typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, clampedRadius);
    return;
  }

  if (clampedRadius > 0) {
    ctx.beginPath();
    ctx.moveTo(x + clampedRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, clampedRadius);
    ctx.arcTo(x + width, y + height, x, y + height, clampedRadius);
    ctx.arcTo(x, y + height, x, y, clampedRadius);
    ctx.arcTo(x, y, x + width, y, clampedRadius);
    ctx.closePath();
    return;
  }

  ctx.beginPath();
  ctx.rect(x, y, width, height);
};

const drawDecorationRects = (ctx: CanvasRenderingContext2D, rects: any[] | null | undefined) => {
  if (!rects || rects.length === 0) {
    return;
  }
  for (const rect of rects) {
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const spec = rect.decoration?.spec || {};
    if (spec.backgroundColor) {
      ctx.fillStyle = spec.backgroundColor;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    if (spec.borderColor && (spec.borderWidth ?? 1) > 0) {
      ctx.strokeStyle = spec.borderColor;
      ctx.lineWidth = Number.isFinite(spec.borderWidth) ? spec.borderWidth : 1;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    if (spec.underline?.color) {
      ctx.strokeStyle = spec.underline.color;
      ctx.lineWidth = 1;
      const underlineY = rect.y + rect.height - 2;
      if (spec.underline.style === "wavy") {
        drawMarkWavyLine(ctx, rect.x, underlineY, rect.width);
      } else {
        ctx.beginPath();
        ctx.moveTo(rect.x, underlineY);
        ctx.lineTo(rect.x + rect.width, underlineY);
        ctx.stroke();
      }
    }
  }
};

const drawDecorationTexts = (
  ctx: CanvasRenderingContext2D,
  segments: any[] | null | undefined
) => {
  if (!segments || segments.length === 0) {
    return;
  }
  ctx.textBaseline = "top";
  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }
    ctx.font = segment.font;
    ctx.fillStyle = segment.color;
    ctx.fillText(segment.text, segment.x, segment.y);
  }
};

const drawDecorationWidgets = (
  ctx: CanvasRenderingContext2D,
  widgets: any[] | null | undefined
) => {
  if (!widgets || widgets.length === 0) {
    return;
  }
  for (const widget of widgets) {
    const render = widget.decoration?.spec?.render;
    if (typeof render === "function") {
      render(ctx, widget.x, widget.y, widget.height);
    }
  }
};

export const renderOverlayLayer = ({
  ctx,
  settings,
  clientHeight,
  caret,
  selectionRects = [],
  blockRects = [],
  decorations = null,
}: {
  ctx: CanvasRenderingContext2D;
  settings: any;
  clientHeight: number;
  caret: any;
  selectionRects?: any[];
  blockRects?: any[];
  decorations?: DecorationDrawData | null;
}) => {
  if (decorations) {
    drawDecorationRects(ctx, decorations.inlineRects);
    drawDecorationTexts(ctx, decorations.textSegments);
    drawDecorationRects(ctx, decorations.nodeRects);
    drawDecorationWidgets(ctx, decorations.widgets);
  }

  const hasSelectionRects = Array.isArray(selectionRects) && selectionRects.length > 0;
  const hasBlockRects = Array.isArray(blockRects) && blockRects.length > 0;
  const overlayRects = hasSelectionRects ? selectionRects : hasBlockRects ? blockRects : [];

  if (overlayRects.length > 0) {
    const selectionStyle = resolveSelectionStyle(settings);
    const isBlockHighlightOnly = !hasSelectionRects && hasBlockRects;
    const hasFillBase = !isBlockHighlightOnly && !!selectionStyle.fill;
    const hasStroke = !!selectionStyle.stroke && selectionStyle.strokeWidth > 0;

    if (hasFillBase) {
      ctx.fillStyle = selectionStyle.fill;
    }
    if (hasStroke) {
      ctx.strokeStyle = selectionStyle.stroke;
      ctx.lineWidth = selectionStyle.strokeWidth;
    }

    for (const rect of overlayRects) {
      const inset = selectionStyle.inset || 0;
      const x = rect.x + inset;
      const y = rect.y + inset;
      const width = rect.width - inset * 2;
      const height = rect.height - inset * 2;

      if (width <= 0 || height <= 0) {
        continue;
      }

      drawSelectionRectPath(ctx, x, y, width, height, selectionStyle.radius || 0);

      const borderOnly = rect?.borderOnly === true;
      if (hasFillBase && !borderOnly) {
        ctx.fill();
      }
      if (hasStroke) {
        ctx.stroke();
      }
    }
  }

  if (!caret) {
    return;
  }
  const caretBottom = caret.y + caret.height;
  if (caretBottom >= 0 && caret.y <= clientHeight) {
    ctx.fillStyle = "#111827";
    ctx.fillRect(caret.x, caret.y, 1, caret.height);
  }
};
