import { drawWavyLine as drawMarkWavyLine } from "lumenpage-render-engine";
import { type DecorationDrawData } from "./decorations.js";

export type RendererOverlayDisplayListItem = {
  kind:
    | "decoration-inline-rects"
    | "decoration-text-segments"
    | "decoration-node-rects"
    | "decoration-widgets"
    | "selection-rects"
    | "caret";
  paint: (ctx: CanvasRenderingContext2D) => void;
};

export type RendererOverlayDisplayList = {
  items: RendererOverlayDisplayListItem[];
};

export const executeRendererOverlayDisplayList = ({
  ctx,
  displayList,
}: {
  ctx: CanvasRenderingContext2D;
  displayList: RendererOverlayDisplayList;
}) => {
  for (const item of displayList.items) {
    item.paint(ctx);
  }
};

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
    stroke: resolveColor(style.stroke, null),
    strokeWidth: Number.isFinite(style.strokeWidth) ? style.strokeWidth : 0,
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
    const sideWidths = {
      top: Number.isFinite(spec.borderTopWidth) ? Number(spec.borderTopWidth) : 0,
      right: Number.isFinite(spec.borderRightWidth) ? Number(spec.borderRightWidth) : 0,
      bottom: Number.isFinite(spec.borderBottomWidth) ? Number(spec.borderBottomWidth) : 0,
      left: Number.isFinite(spec.borderLeftWidth) ? Number(spec.borderLeftWidth) : 0,
    };
    const hasSideBorders =
      sideWidths.top > 0 || sideWidths.right > 0 || sideWidths.bottom > 0 || sideWidths.left > 0;
    if (spec.borderColor && hasSideBorders) {
      ctx.fillStyle = spec.borderColor;
      if (sideWidths.top > 0) {
        ctx.fillRect(rect.x, rect.y, rect.width, sideWidths.top);
      }
      if (sideWidths.right > 0) {
        ctx.fillRect(rect.x + rect.width - sideWidths.right, rect.y, sideWidths.right, rect.height);
      }
      if (sideWidths.bottom > 0) {
        ctx.fillRect(rect.x, rect.y + rect.height - sideWidths.bottom, rect.width, sideWidths.bottom);
      }
      if (sideWidths.left > 0) {
        ctx.fillRect(rect.x, rect.y, sideWidths.left, rect.height);
      }
    } else if (spec.borderColor && (spec.borderWidth ?? 1) > 0) {
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

const buildSelectionOverlayItem = ({
  settings,
  selectionRects = [],
  blockRects = [],
}: {
  settings: any;
  selectionRects?: any[];
  blockRects?: any[];
}) => {
  const hasSelectionRects = Array.isArray(selectionRects) && selectionRects.length > 0;
  const hasBlockRects = Array.isArray(blockRects) && blockRects.length > 0;
  const overlayRects = hasSelectionRects ? selectionRects : hasBlockRects ? blockRects : [];

  if (overlayRects.length === 0) {
    return null;
  }

  return {
    kind: "selection-rects",
    paint: (ctx: CanvasRenderingContext2D) => {
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
    },
  } satisfies RendererOverlayDisplayListItem;
};

const buildCaretOverlayItem = ({
  clientHeight,
  caret,
}: {
  clientHeight: number;
  caret: any;
}) => {
  if (!caret) {
    return null;
  }
  const caretBottom = caret.y + caret.height;
  if (caretBottom < 0 || caret.y > clientHeight) {
    return null;
  }

  return {
    kind: "caret",
    paint: (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = "#111827";
      ctx.fillRect(caret.x, caret.y, 1, caret.height);
    },
  } satisfies RendererOverlayDisplayListItem;
};

export const buildRendererOverlayDisplayList = ({
  settings,
  clientHeight,
  caret,
  selectionRects = [],
  blockRects = [],
  decorations = null,
}: {
  settings: any;
  clientHeight: number;
  caret: any;
  selectionRects?: any[];
  blockRects?: any[];
  decorations?: DecorationDrawData | null;
}): RendererOverlayDisplayList => {
  const items: RendererOverlayDisplayListItem[] = [];

  if (decorations?.inlineRects?.length) {
    items.push({
      kind: "decoration-inline-rects",
      paint: (ctx) => drawDecorationRects(ctx, decorations.inlineRects),
    });
  }
  if (decorations?.textSegments?.length) {
    items.push({
      kind: "decoration-text-segments",
      paint: (ctx) => drawDecorationTexts(ctx, decorations.textSegments),
    });
  }
  if (decorations?.nodeRects?.length) {
    items.push({
      kind: "decoration-node-rects",
      paint: (ctx) => drawDecorationRects(ctx, decorations.nodeRects),
    });
  }
  if (decorations?.widgets?.length) {
    items.push({
      kind: "decoration-widgets",
      paint: (ctx) => drawDecorationWidgets(ctx, decorations.widgets),
    });
  }

  const selectionItem = buildSelectionOverlayItem({
    settings,
    selectionRects,
    blockRects,
  });
  if (selectionItem) {
    items.push(selectionItem);
  }

  const caretItem = buildCaretOverlayItem({
    clientHeight,
    caret,
  });
  if (caretItem) {
    items.push(caretItem);
  }

  return {
    items,
  };
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
  executeRendererOverlayDisplayList({
    ctx,
    displayList: buildRendererOverlayDisplayList({
      settings,
      clientHeight,
      caret,
      selectionRects,
      blockRects,
      decorations,
    }),
  });
};
